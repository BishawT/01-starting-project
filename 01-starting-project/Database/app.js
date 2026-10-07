import { createServer } from 'node:http';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  createSession,
  destroySession,
  readSession,
} from './session.js';

const scryptAsync = promisify(scrypt);
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
  } catch {
    // No .env file available; fall back to the environment below.
  }
}

const port = Number(process.env.PORT) || 3001;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. See Database/.env.example for an example.');
}

const ssl =
  process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(ssl ? { ssl } : {}),
});

async function initializeDatabase() {
  await db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

  // session.js writes to this table; without it a fresh database accepts
  // registrations and then fails on the first login.
  await db.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
  );
  `);
}

function sendJson(response, statusCode, body, cookies = []) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Set-Cookie is a special case: it may appear more than once, so it has to be
  // supplied as an ARRAY. Passing a single comma-joined string produces one
  // malformed header that browsers silently drop.
  if (cookies.length > 0) {
    headers['Set-Cookie'] = cookies;
  }

  response.writeHead(statusCode, headers);
  response.end(JSON.stringify(body));
}

// The Secure flag requires HTTPS. On http://localhost we leave it off; in
// production we require it.
function shouldUseSecureCookies() {
  return process.env.NODE_ENV === 'production' || process.env.USE_SECURE_COOKIES === 'true';
}

// Strips any query string so the route table cannot be bypassed with ?foo=bar.
function getPath(request) {
  return new URL(request.url, 'http://localhost').pathname;
}

// ─── Static files ───────────────────────────────────────────────────────────
// In production ONE process serves both the built React app and the API: the
// same origin, no CORS preflight, no second service to deploy. Locally you
// still run `vite` for hot reload, and Vite proxies /api here.

const distDir = fileURLToPath(new URL('../dist', import.meta.url));

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveStatic(request, pathname, response) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const resolved = normalize(join(distDir, requested));

  // reject ../ escapes before touching the filesystem
  const isInsideDist = resolved === distDir || resolved.startsWith(distDir + sep);

  let filePath = isInsideDist ? resolved : null;
  let body = filePath ? await readFile(filePath).catch(() => null) : null;

  // Unknown path without a file extension → the app's own index.html, so a
  // deep link still loads. A missing .js/.css is a real 404, not HTML.
  if (!body && extname(requested) === '') {
    filePath = join(distDir, 'index.html');
    body = await readFile(filePath).catch(() => null);
  }

  if (!body || !filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found. Run `npm run build` first — there is no dist/ folder.');
    return;
  }

  const isHtml = extname(filePath) === '.html';
  const isHashedAsset = filePath.includes(`${sep}assets${sep}`);

  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': isHtml
      ? 'no-cache'
      : isHashedAsset
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

// Deny by default: anything not listed here is a 404.
const ROUTES = {
  'POST /api/auth/register': 'register',
  'POST /api/auth/login': 'login',
  'POST /api/auth/logout': 'logout',
  'GET /api/auth/session': 'session',
};

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error('Request body is too large.');
  }
  return JSON.parse(body || '{}');
}

function validateCredentials(email, password) {
  if (typeof email !== 'string' || !email.trim().includes('@')) {
    return 'Enter a valid email address.';
  }
  if (typeof password !== 'string' || password.trim().length < 6) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scryptAsync(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  const path = getPath(request);

  // Everything that is not the API is the built frontend.
  if (!path.startsWith('/api/')) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed.');
      return;
    }
    await serveStatic(request, path, response);
    return;
  }

  const route = ROUTES[`${request.method} ${path}`];
  if (!route) {
    sendJson(response, 404, { message: 'Route not found.' });
    return;
  }

  // These two take no body, so they are handled before readJson().
  if (route === 'session') {
    const session = await readSession(db, request);
    if (!session) {
      sendJson(response, 401, { message: 'Not signed in.' });
      return;
    }
    sendJson(response, 200, { email: session.email, expiresAt: session.expiresAt });
    return;
  }

  if (route === 'logout') {
    await destroySession(db, request);
    sendJson(response, 200, { message: 'Signed out.' }, [buildExpiredSessionCookie()]);
    return;
  }

  try {
    const { email, password } = await readJson(request);
    const validationError = validateCredentials(email, password);
    if (validationError) {
      sendJson(response, 400, { message: validationError });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (route === 'register') {
      const { salt, hash } = await hashPassword(password);
      try {
        await db.query(
          'INSERT INTO users (email, password_hash, password_salt) VALUES ($1, $2, $3)',
          [normalizedEmail, hash, salt]
        );
        sendJson(response, 201, { message: 'Account created. You can now sign in.' });
      } catch (error) {
        if (error.code === '23505') {
          sendJson(response, 409, { message: 'An account with this email already exists.' });
          return;
        }
        throw error;
      }
      return;
    }

    const result = await db.query(
      'SELECT id, email, password_hash, password_salt FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];
    if (!user) {
      sendJson(response, 401, { message: 'Email or password is incorrect.' });
      return;
    }

    const { hash } = await hashPassword(password, user.password_salt);
    const passwordMatches = timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(user.password_hash, 'hex')
    );
    if (!passwordMatches) {
      sendJson(response, 401, { message: 'Email or password is incorrect.' });
      return;
    }

    // The password is verified, so hand out a session. The raw token goes only
    // into the Set-Cookie header — never into the JSON body, where JavaScript
    // could read it.
    const { token, expiresAt } = await createSession(db, user.id);

    sendJson(
      response,
      200,
      { email: user.email, expiresAt },
      [buildSessionCookie(token, { secure: shouldUseSecureCookies() })]
    );
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid request body.' : 'Unable to process your request.';
    sendJson(response, 400, { message });
  }
});

initializeDatabase()
  .then(() => {
    server.listen(port, () => {
      console.log(`Authentication API listening at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Could not connect to PostgreSQL.', error);
    process.exit(1);
  });
