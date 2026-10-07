// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Create, look up, and destroy login sessions for the ReactArt API.
// WHERE:  Paste into 01-starting-project/Database/session.js
//         (import it from Database/app.js — see app-additions.js)
// WHY:    A session is the server's memory of "who is signed in". Without it the
//         server has no idea who is making a request, so it cannot protect
//         anything. This file owns that memory.
//
// DESIGN NOTES
//   • The cookie holds a 32-byte random token.
//   • The database holds only sha256(token) — never the token itself.
//     If the DB leaks, no live session can be reconstructed from it.
//   • No JWT, no cookie-signing secret to rotate. Stateless by choice: a
//     stolen session is revocable, which is the whole point of Ch. 6.
// ────────────────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'sid';
export const SESSION_TTL_DAYS = 30;

// ─── Token helpers ──────────────────────────────────────────────────────────

/**
 * sha256 of the raw token.
 *
 * Why sha256 and not scrypt (which hashPassword() uses)?
 *
 *   Passwords  → weak, human-chosen → must be SLOW to brute-force → scrypt.
 *   Tokens      → 256 bits of CSPRNG output → nothing to brute-force,
 *                 the search space is 2^256 → a fast hash is fine, and it
 *                 keeps the per-request cost of auth negligible.
 *
 * Slowing down token hashing would make every authenticated API call slower
 * to defend against an attack that is already computationally impossible.
 */
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// ─── Cookie serialisation ───────────────────────────────────────────────────
// You are talking to raw node:http (no Express), so there is no cookie parser
// or res.cookie() helper. We build the header strings by hand.
//
// Format: name=value; Attribute; Attribute; ...
// Multiple cookies in one response: separate them with \r\n — NOT commas.
// Commas are legal *inside* an Expires date, which is the classic bug here.

// A cookie value must not contain these characters, or the header is invalid.
// Hex output never contains them, so our sid is safe by construction — but
// validating is still worth it, because it documents the rule.
const SAFE_COOKIE_VALUE = /^[A-Za-z0-9._~-]+$/;

/**
 * Build a Set-Cookie header value for the session cookie.
 *
 * The flags, and why each one is here:
 *
 *   HttpOnly      JS cannot read document.cookie. An XSS bug cannot exfiltrate
 *                 the session. This is the single most important flag.
 *   SameSite=Lax  The cookie is sent on top-level navigation and on same-site
 *                 fetches, but NOT on cross-site POSTs. That blunts CSRF: a
 *                 hostile page cannot make the browser auto-submit a form to
 *                 /api/auth/logout or any state-changing endpoint.
 *   Path=/       Send it for every route, not just /api.
 *   Max-Age       Absolute lifetime in seconds. Without it the cookie is a
 *                 "session cookie" that dies when the browser closes — users
 *                 would be logged out every time they quit their laptop.
 *
 * NOT set here, and read why:
 *   Secure        Requires HTTPS. On localhost, Chrome does treat
 *                 http://localhost as a secure context and will store a Secure
 *                 cookie, but Safari is inconsistent. Add `Secure` when you
 *                 deploy — see the checklist in Ch. 6.
 *
 * @param {string} token raw token (hex) to hand to the browser
 * @returns {string} a Set-Cookie header value
 */
export function buildSessionCookie(token, { secure = false } = {}) {
  if (!SAFE_COOKIE_VALUE.test(token)) {
    throw new Error('Refusing to build a cookie with unsafe characters in the value.');
  }
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Build a Set-Cookie header that deletes the cookie.
 *
 * To delete a cookie you do not send an empty value — you send the SAME name
 * with Max-Age=0 (and an already-past Expires, for older clients). Name, Path
 * and Domain must match the original cookie or the browser keeps it.
 */
export function buildExpiredSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Read one cookie out of a Node request.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {string} name
 * @returns {string|undefined} the decoded value, or undefined if absent
 */
export function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return undefined;         // no Cookie header at all — not logged in

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;            // a chunk with no '=' is malformed; skip it
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;          // not the one we want
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

// ─── The three session operations ───────────────────────────────────────────

/**
 * Issue a new session for a user.
 *
 * @param {import('pg').PoolBase} db
 * @param {number} userId
 * @returns {Promise<{ token: string, expiresAt: string }>}
 *          token goes into the Set-Cookie header, NEVER into a JSON body.
 */
export async function createSession(db, userId) {
  // 32 bytes = 256 bits of entropy. randomBytes is a CSPRNG: it is
  // unpredictable, unlike Math.random(). Never use Math.random() here.
  const token = randomBytes(32).toString('hex');

  // expires_at is computed by Postgres, not by JavaScript, so every session in
  // the table agrees on "now". Doing it in JS means clock-skew bugs.
  const { rows } = await db.query(
    `INSERT INTO sessions (token_hash, user_id)
     VALUES ($1, $2)
     RETURNING expires_at`,
    [hashToken(token), userId],
  );

  return { token, expiresAt: rows[0].expires_at };
}

/**
 * Look up the session for a request and load its user.
 *
 * Order matters: the hash lookup is an indexed equality match (fast), and only
 * the rows that match get their expiry checked. Checking expiry in SQL lets the
 * database do the work and guarantees expired rows are treated as absent
 * everywhere, not just here.
 *
 * Returns null — never throws — for every "not signed in" case, because they
 * are all the same thing to the caller: no session.
 *
 * @param {import('pg').PoolBase} db
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<{ email: string, userId: string, expiresAt: string }|null>}
 */
export async function readSession(db, request) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  // Defence in depth: a malformed value cannot even reach the database.
  if (!SAFE_COOKIE_VALUE.test(token)) return null;

  const { rows } = await db.query(
    `SELECT s.user_id, s.expires_at, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > CURRENT_TIMESTAMP`,
    [hashToken(token)],
  );

  const row = rows[0];
  if (!row) return null;
  return { email: row.email, userId: String(row.user_id), expiresAt: row.expires_at };
}

/**
 * Destroy one session (logout).
 *
 * Scoped to the token that presented itself: a user logging out only kills their
 * own session. There is no `DELETE FROM sessions` on this path — that would log
 * the user out of every device at once, which is a different feature.
 *
 * Idempotent by design: logging out twice, or without a cookie, is a no-op that
 * still returns 200. Telling an attacker "you weren't logged in" is free
 * information.
 *
 * @param {import('pg').PoolBase} db
 * @param {import('node:http').IncomingMessage} request
 */
export async function destroySession(db, request) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token || !SAFE_COOKIE_VALUE.test(token)) return;

  await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

/**
 * Housekeeping: remove rows that are already expired.
 *
 * The `expires_at > CURRENT_TIMESTAMP` filter in readSession() already makes
 * expired sessions useless, so this is not a *security* task — it is a storage
 * task. Without it the table grows forever.
 *
 * Run it from a cron job or a setInterval, roughly daily:
 *   node -e "..."
 */
export async function purgeExpiredSessions(db) {
  const { rowCount } = await db.query(
    'DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP',
  );
  return rowCount;
}

/**
 * Housekeeping: cap how many sessions one user may hold.
 *
 * Attack shape: an attacker with a stolen password signs in from 500 machines to
 * make the real user's session look like one of many. Capping sessions keeps
 * that from hiding in the noise — and logging out the *oldest* session is a
 * cheap signal that something is wrong.
 *
 * Optionally log the user out everywhere:
 *   DELETE FROM sessions WHERE user_id = $1
 */
export async function enforceSessionLimit(db, userId, maxSessions = 5) {
  await db.query(
    `DELETE FROM sessions
      WHERE user_id = $1
        AND id NOT IN (
          SELECT id FROM sessions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2
        )`,
    [userId, maxSessions],
  );
}