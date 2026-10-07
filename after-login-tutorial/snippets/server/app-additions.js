// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   The exact edits to Database/app.js that add sessions, written as
//         self-contained functions you paste in.
// WHERE:  01-starting-project/Database/app.js
// WHY:    app.js has a single catch-all route guard at line 78 and one big
//         handler. This shows the smallest edits that add a session layer
//         without restructuring the file.
//
// The four changes, in order of appearance in app.js:
//   1. (top)      import the session helpers
//   2. (line 38)  sendJson must be able to send a Set-Cookie header
//   3. (line 78)  the route allowlist gains /api/auth/session and /logout,
//                  and GET must now be allowed
//   4. (line 131) the login response creates a session and sends the cookie
//
// Nothing below is imported automatically — copy the pieces you need.
// ────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// CHANGE 1 — the import (add near the top of app.js, with the others)
// ═══════════════════════════════════════════════════════════════════════════

// import {
//   createSession,
//   readSession,
//   destroySession,
//   buildSessionCookie,
//   buildExpiredSessionCookie,
// } from './session.js';


// ═══════════════════════════════════════════════════════════════════════════
// CHANGE 2 — sendJson gains a `cookies` option
//
// The existing helper hardcodes its headers:
//
//   function sendJson(response, statusCode, body) {          // app.js:38
//     response.writeHead(statusCode, {
//       'Content-Type': 'application/json',
//       'Access-Control-Allow-Origin': 'http://localhost:3000',
//       'Access-Control-Allow-Methods': 'POST, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type',
//     });
//     response.end(JSON.stringify(body));
//   }
//
// writeHead() REPLACES the whole header object, so to add Set-Cookie you must
// pass it in the same call. This version threads an optional array of cookies
// through. Set-Cookie is special: you may send several, and they must be
// supplied as an ARRAY so Node writes one header line per cookie. Passing a
// single comma-joined string produces one malformed header the browser silently
// drops — which is the single most common session bug in hand-rolled Node auth.
// ═══════════════════════════════════════════════════════════════════════════

function sendJson(response, statusCode, body, cookies = []) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Only add the header when there is something to send. An empty array would
  // otherwise produce a stray empty Set-Cookie line.
  if (cookies.length > 0) {
    headers['Set-Cookie'] = cookies;
  }

  response.writeHead(statusCode, headers);
  response.end(JSON.stringify(body));
}

/**
 * Should the session cookie carry the `Secure` flag?
 *
 * It depends on HTTPS, not on localhost — so decide this at runtime rather than
 * hardcoding either answer:
 *   - set USE_SECURE_COOKIES=true in your env for production
 *   - leave it unset locally, where you are on http://localhost
 *
 * Trade-off of leaving it off in dev: an http://localhost page could send this
 * cookie over a cleartext connection to a network attacker. That risk is
 * acceptable for local development and does not exist once you are behind TLS.
 */
function shouldUseSecureCookies() {
  return process.env.NODE_ENV === 'production' || process.env.USE_SECURE_COOKIES === 'true';
}


// ═══════════════════════════════════════════════════════════════════════════
// CHANGE 3 — the routing table
//
// Currently (app.js:78):
//
//   if (request.method !== 'POST' || !['/api/auth/register', '/api/auth/login'].includes(request.url)) {
//     sendJson(response, 404, { message: 'Route not found.' });
//     return;
//   }
//
// Two problems for a session system:
//   1. Only POST is allowed — but "am I still signed in?" must be a GET,
//      because it changes nothing. GET is also cacheable and harmless to retry.
//   2. The allowlist must name the new endpoints.
//
// A route table makes this readable and is where you would add every later
// authenticated endpoint.
// ═══════════════════════════════════════════════════════════════════════════

// Split the URL into a path and nothing else. Using new URL() with a fixed base
// strips the query string and keeps this correct if anyone later adds ?foo=bar.
function getPath(request) {
  return new URL(request.url, 'http://localhost').pathname;
}

// Method per route. Everything else is 404 — deny by default.
const ROUTES = {
  'POST /api/auth/register': 'register',
  'POST /api/auth/login': 'login',
  'POST /api/auth/logout': 'logout',   // POST, not GET: logout changes state.
  'GET /api/auth/session': 'session',  // GET: it only reads.
};

function matchRoute(request) {
  return ROUTES[`${request.method} ${getPath(request)}`];
}


// ═══════════════════════════════════════════════════════════════════════════
// CHANGE 4 — the handler body
//
// Replaces the routing guard at app.js:78 and the success path at app.js:131.
// The register and login logic in between is unchanged.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/session — "who am I?" (or 401)
 *
 * This is the endpoint that makes Job 3 from Ch. 1 possible: on a fresh page
 * load, with no React state at all, the client can ask this question and get a
 * truthful answer.
 *
 * Returns 401 rather than 200 with {user: null}. 401 is the honest status code,
 * and it lets the client distinguish "signed out" from "server broken" — a
 * distinction that matters, because only one of those is a normal state.
 *
 * Include expiresAt so the client can warn about expiry. It is not a secret:
 * the user already knows roughly when they logged in, and the real authority is
 * always the server's check, never this value.
 */
async function handleSession(request, response, db) {
  const session = await readSession(db, request);

  if (!session) {
    sendJson(response, 401, { message: 'Not signed in.' });
    return;
  }

  sendJson(response, 200, {
    email: session.email,
    expiresAt: session.expiresAt,
  });
}

/**
 * POST /api/auth/logout — destroy this session.
 *
 * Sends an already-expired cookie so the browser deletes its copy too. Forgetting
 * the DB row without clearing the cookie leaves the user "logged in" until the
 * stale value stops matching — confusing, and it hides real bugs during testing.
 */
async function handleLogout(request, response, db) {
  await destroySession(db, request);
  sendJson(response, 200, { message: 'Signed out.' }, [buildExpiredSessionCookie()]);
}

/**
 * Wraps the register path so a successful signup does NOT hand out a session.
 *
 * Why? The current UX already asks the user to sign in after registering
// (AuthInputs.jsx:46-50 flips the mode to 'login' and shows
 * data.message). Two designs exist:
 *
 *   (a) Register → redirect to login.   ← matches your current UX
 *   (b) Register → signed in immediately, skip the form.
 *
 * (b) is fewer clicks and is what most real products do, but it is a behaviour
 * change, so it is a decision rather than an accident. If you pick (b), call
 * createSession() here and return the cookie. Do not do both — issuing a session
 * on register while the UI also demands a login produces two sessions for one
 * user.
 */
async function handleRegister(request, response, db) {
  // ... unchanged validation + INSERT ...
  sendJson(response, 201, { message: 'Account created. You can now sign in.' });
}

/**
 * POST /api/auth/login — verify, then issue a session.
 *
 * The change from app.js:131 is everything after the password check.
 */
async function handleLogin(request, response, db) {
  // ... unchanged: validate, normalizeEmail, SELECT, hashPassword,
  //     timingSafeEqual, and the 401 early returns ...

  // ── this is new ──────────────────────────────────────────────────────────

  // Prove to ourselves that the password was right before handing out a
  // session. Your existing code already returns at this point on failure.
  // (If you use handleRegister's "sign in immediately" flow from CHANGE 4,
  // createSession goes here instead, and the response includes the cookie.)

  const { token, expiresAt } = await createSession(db, user.id);

  // Optional hardening — see enforceSessionLimit() in session.js.
  // await enforceSessionLimit(db, user.id, 5);

  sendJson(
    response,
    200,
    // The token is NOT in this object. It exists only in the Set-Cookie header,
    // where HttpOnly keeps it away from JavaScript.
    { email: user.email, expiresAt },
    [buildSessionCookie(token, { secure: shouldUseSecureCookies() })],
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// The wiring — how the pieces fit inside the existing createServer callback
// ═══════════════════════════════════════════════════════════════════════════

/*
const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});              // CORS preflight
    return;
  }

  const route = matchRoute(request);
  if (!route) {
    sendJson(response, 404, { message: 'Route not found.' });
    return;
  }

  try {
    if (route === 'session') {
      await handleSession(request, response, db);   // GET — no body to read
      return;
    }
    if (route === 'logout') {
      await handleLogout(request, response, db);
      return;
    }

    // Both remaining routes are POSTs with { email, password }.
    const { email, password } = await readJson(request);
    const validationError = validateCredentials(email, password);
    if (validationError) {
      sendJson(response, 400, { message: validationError });
      return;
    }

    if (route === 'register') {
      await handleRegister(request, response, db);
      return;
    }

    await handleLogin(request, response, db);
  } catch (error) {
    const message = error instanceof SyntaxError
      ? 'Invalid request body.'
      : 'Unable to process your request.';
    sendJson(response, 400, { message });
  }
});
*/


// ═══════════════════════════════════════════════════════════════════════════
// How to verify the cookie actually works — no React required
// ═══════════════════════════════════════════════════════════════════════════

/*
Run the server, then use curl:

  # 1. Sign in. -i shows response headers; -c stores cookies to a jar file.
  curl -i -c jar.txt -X POST http://localhost:3001/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"you@example.com","password":"secret123"}'

  Look for:  Set-Cookie: sid=<64 hex chars>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000

  # 2. Ask who you are. -b replays the jar.
  curl -i -b jar.txt http://localhost:3001/api/auth/session

  # 3. Log out.
  curl -i -b jar.txt -X POST http://localhost:3001/api/auth/logout

  # 4. Ask again — now expect 401. This is Job 4 from Ch. 1, verified.

If step 2 returns 401 while step 1 sent a cookie, the usual suspects, in order:
  a) Set-Cookie was passed as a string instead of an array in sendJson
  b) the cookie Name/Path do not match, so the browser kept the old one
  c) the sessions table is missing, so the INSERT threw (check your server log)
  d) you are calling :3001 from the browser instead of going through the /api proxy
*/