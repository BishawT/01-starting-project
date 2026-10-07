# Chapter 3 — Server-Side Sessions

This is the heart of the tutorial. By the end, the server will have memory.

**Files for this chapter:** `snippets/database.sql`, `snippets/server/session.js`,
`snippets/server/app-additions.js`

---

## Step 1 — The table

Run `snippets/database.sql` against your `auth_app` database. It creates one table:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);
```

Four decisions, each of which is a decision:

### `token_hash`, not `token`

The cookie carries a random string; the table stores its SHA-256. If someone leaks
your database, they hold values they cannot turn back into working cookies. The
`UNIQUE` constraint is what makes the lookup a single index hit.

Contrast this with `users.password_hash` in `app.js:31`. Same principle, different
algorithm, and the reason is worth holding onto:

| | Password | Session token |
|---|---|---|
| Entropy | Low — humans pick "password123" | 256 bits of CSPRNG output |
| Attacker has to | Guess and hope | Search 2²⁵⁶ possibilities |
| So we hash it with | `scrypt` — deliberately **slow** | `sha256` — fast is fine |

Deliberately slowing down password hashing is what makes guessing expensive. For
tokens there is nothing to guess, so a slow hash buys nothing and costs you latency
on *every* request. Fast for tokens is correct, not lazy.

### `ON DELETE CASCADE`

Delete a user, and their sessions disappear with them. Without it you get orphan rows
whose `user_id` points at nothing — and an orphan row is a session that "authenticates"
a user who does not exist.

### `expires_at` computed by Postgres

```sql
DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
```

Not `NOW() + 30 days` in JavaScript. Server clocks drift; database clocks are the one
clock everyone agrees on. An expiry computed in two places is an expiry that will
disagree in two places.

### Two indexes

`token_hash` gets one free from `UNIQUE` — that serves the hot path (every
authenticated request). `expires_at` and `(user_id, created_at DESC)` serve the
housekeeping jobs, which you would otherwise run as full table scans.

---

## Step 2 — Issuing a session

```js
// snippets/server/session.js → createSession()
const token = randomBytes(32).toString('hex');

const { rows } = await db.query(
  `INSERT INTO sessions (token_hash, user_id)
   VALUES ($1, $2)
   RETURNING expires_at`,
  [hashToken(token), userId],
);

return { token, expiresAt: rows[0].expires_at };
```

### Why `randomBytes` and not `Math.random()`

`Math.random()` is fast, not secret. It is a deterministic generator seeded from
program start, so an attacker who can observe enough output can reconstruct it and
predict every future value — including your next session token. `randomBytes` draws
from the OS CSPRNG. Rule of thumb: **`Math.random()` for games and CSS jitter;
`randomBytes` for anything that grants access.**

### Why the `RETURNING` clause

Postgres can hand you the computed `expires_at` back in the same round trip, instead
of making you `SELECT` it. Fewer queries, and no chance of the two disagreeing.

### Parameterised queries — the one rule you never bend

```js
db.query('... WHERE s.token_hash = $1', [hashToken(token)])   // ✅
```

The `$1` is a placeholder. The value travels to Postgres separately from the SQL text,
where it can only ever *be a value*, never be parsed as code. Compare with string
concatenation:

```js
db.query(`... WHERE s.token_hash = '${token}'`)               // ❌ NEVER
```

Here, a crafted `token` becomes part of the SQL. This is SQL injection. Your existing
code already does the right thing everywhere — `app.js:96-99`, `app.js:112-113`,
`app.js:123` — so this is a note on keeping it up, not a fix.

---

## Step 3 — Reading a session back

```js
// snippets/server/session.js → readSession()
const token = readCookie(request, SESSION_COOKIE_NAME);
if (!token) return null;
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
```

### Parsing cookies by hand

You are on raw `node:http`, with no Express, so `session.js` parses the header itself:

```js
for (const part of header.split(';')) {
  const eq = part.indexOf('=');
  if (eq === -1) continue;
  const key = part.slice(0, eq).trim();
  if (key !== name) continue;
  return decodeURIComponent(part.slice(eq + 1).trim());
}
```

Line by line:

- `header.split(';')` — cookies are separated by `; `.
- `indexOf('=')` returns `-1` when a chunk has no `=`. `if (eq === -1) continue` skips
  that malformed chunk instead of crashing. **Do not write `part.split('=')`** here: a
  value may legitimately contain `=` (base64 padding), so only the *first* one
  separates name from value.
- `.trim()` on both halves — the spec allows `; ` with a space, and browsers send it.
- `decodeURIComponent` — cookies are URL-encoded; values can contain spaces or `;`.

### Expiry is checked in SQL, not JavaScript

```sql
AND s.expires_at > CURRENT_TIMESTAMP
```

An expired row and a nonexistent row both produce `rows.length === 0`. Put the check in
one place — the database — and it holds for every query that touches this table,
including future ones you have not written yet.

### It returns `null`, never throws

Every "not signed in" case collapses to `null`:

- no `Cookie` header
- no `sid` cookie
- a malformed value (rejected before touching the database)
- no matching row
- a matching but expired row

The caller does not need five branches. And critically, **no branch distinguishes
them in the response** — every one is a flat `401 { message: 'Not signed in.' }`. A
distinguishable "your session expired" vs "wrong token" would be information an
attacker can use.

> `String(row.user_id)` in the return — `BIGINT` arrives from `pg` as a *string*, not a
> number. That surprises people, and it is deliberate: `BIGINT` can exceed
> `Number.MAX_SAFE_INTEGER`, so `pg` will not risk a precision error on your behalf.
> If you compare `userId === 5` anywhere it silently fails, because you are comparing a
> string to a number.

---

## Step 4 — The Set-Cookie header

This is where `HttpOnly` earns its keep.

```js
// snippets/server/session.js → buildSessionCookie()
const parts = [
  `${SESSION_COOKIE_NAME}=${token}`,
  'HttpOnly',
  'SameSite=Lax',
  'Path=/',
  `Max-Age=${maxAge}`,
];
if (secure) parts.push('Secure');
return parts.join('; ');
```

Produces:

```
sid=9f2a…c41b; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000
```

### The flags, one by one

**`HttpOnly`** — the browser forbids *all* JavaScript on the page from reading this
value, including yours. There is no API to get around it; `document.cookie` simply does
not list it.

This is why the token is never in the JSON body. Compare the two designs:

```js
// Design A: token in the response body
const data = await response.json();
localStorage.setItem('token', data.token);       // reachable by any script

// Design B: token in an HttpOnly cookie
const data = await response.json();             // contains no secret at all
```

With Design A, one XSS bug anywhere in your app — a `dangerouslySetInnerHTML`, a
third-party analytics script, a malicious npm package — reads `localStorage` and
exfiltrates a complete account takeover. With Design B there is nothing there to steal.
**The cookie does not fix XSS. It removes XSS's ability to become session theft.**

**`SameSite=Lax`** — the cookie travels on same-site requests and on top-level
navigation (clicking a link into your app), but *not* on cross-site POSTs. So a hostile
page cannot auto-submit a form to `/api/auth/logout` or any state-changing endpoint.
That is CSRF defence. Note this is not a substitute for a CSRF token on other apps —
`Lax` allows top-level GET navigation, so a GET endpoint that changes state would still
be exposed. Keep destructive things on POST.

**`Path=/`** — send it for every route, not just `/api`. If you set `Path=/api`, a
request to `/` would not carry it and a page reload would lose the session. This is one
of those bugs that looks like "sessions randomly fail on some pages".

**`Max-Age=2592000`** — 30 days, in seconds. Without it you get a *session cookie*,
which the browser discards when it closes. Users would be signed out every time they
quit their browser. `Max-Age` is in **seconds**; `Expires` is a date string. Prefer
`Max-Age`.

**`Secure`** — only over HTTPS. Left off locally because you are on `http://localhost`;
add it in production. `session.js` gates it on a runtime check rather than hardcoding
it either way:

```js
// snippets/server/app-additions.js
function shouldUseSecureCookies() {
  return process.env.NODE_ENV === 'production' || process.env.USE_SECURE_COOKIES === 'true';
}
```

### Deleting a cookie

```js
// snippets/server/session.js → buildExpiredSessionCookie()
`${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
```

You do not send an empty value — you send the **same name**, with `Max-Age=0`. The
browser matches on name + path + domain, so all three must match the original cookie
or you will "delete" nothing. This is why logout must clear both the DB row *and* the
cookie.

---

## Step 5 — Set-Cookie is an array, not a string

The single most common hand-rolled-Node bug:

```js
response.writeHead(200, { 'Set-Cookie': cookieString });     // ⚠ one cookie only
response.writeHead(200, { 'Set-Cookie': [cookieString] });   // ✅ correct
```

`Set-Cookie` is a special case: **it may appear multiple times.** If you have two
cookies you must join them with `\r\n` — *not* with commas — because commas are legal
inside an `Expires` date. Getting this wrong produces one malformed header that
browsers silently drop, and you lose an afternoon.

Pass an array and Node writes one header line per element, correctly:

```js
// snippets/server/app-additions.js
function sendJson(response, statusCode, body, cookies = []) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (cookies.length > 0) {
    headers['Set-Cookie'] = cookies;      // array, not a joined string
  }
  response.writeHead(statusCode, headers);
  response.end(JSON.stringify(body));
}
```

Two side notes on that helper:

- **`Access-Control-Allow-Methods` needed `GET` added.** It previously read
  `'POST, OPTIONS'`.
- **The `Access-Control-Allow-Origin` line is actually redundant here.** Your requests
  go through the Vite proxy (`vite.config.js:10-12`), so the browser sees only
  `localhost:3000` — same-origin. Same-origin requests skip CORS entirely. Leave the
  header; it costs nothing and it is what saves you if you ever split the API onto
  another domain.

---

## Step 6 — The three endpoints

### `GET /api/auth/session` — who am I?

```js
async function handleSession(request, response, db) {
  const session = await readSession(db, request);
  if (!session) {
    sendJson(response, 401, { message: 'Not signed in.' });
    return;
  }
  sendJson(response, 200, { email: session.email, expiresAt: session.expiresAt });
}
```

**Why GET, and not POST?** It changes nothing. It is safe to retry and caches
correctly, which is what the method is for. This is the endpoint that makes a page
reload work — Job 3 from Chapter 1. The client has no memory, so it asks.

**Why `401` and not `200 { user: null }`?** Because "signed out" is a normal state, not
an error to shout about — but it *is* an honest status code, and it lets the client
separate "signed out" (expected, render the form) from "server is broken" (unexpected,
show an error). Conflating the two is how apps end up showing a scary error to users
who simply have not signed in.

### `POST /api/auth/logout` — destroy it

```js
async function handleLogout(request, response, db) {
  await destroySession(db, request);
  sendJson(response, 200, { message: 'Signed out.' }, [buildExpiredSessionCookie()]);
}
```

```js
async function destroySession(db, request) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token || !SAFE_COOKIE_VALUE.test(token)) return;
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}
```

Three deliberate choices:

- **`DELETE ... WHERE token_hash = $1`,** not `DELETE FROM sessions`. Scoped to the
  session that presented itself: signing out on your laptop should not sign you out on
  your phone. "Log out everywhere" is a different, deliberately separate query.
- **Idempotent.** Logging out twice, or without a cookie, returns `200` both times.
  Returning an error would tell an attacker whether they held a valid session — free
  information for free.
- **Both halves.** Row deleted *and* cookie expired. Miss either and the UI lies.

### `POST /api/auth/login` — the whole point

```js
const { token, expiresAt } = await createSession(db, user.id);

sendJson(
  response,
  200,
  { email: user.email, expiresAt },      // ← no token in here
  [buildSessionCookie(token, { secure: shouldUseSecureCookies() })],
);
```

Compare with the current `app.js:131`:

```js
sendJson(response, 200, { email: user.email });   // today: proof is forgotten
```

That one-line difference is the entire tutorial. Everything in Chapter 1's Job 2 and
Job 3 hangs off it.

---

## Step 7 — Housekeeping

Two jobs that are *not* security features, and it is worth being precise about which is
which, because people sometimes delete them thinking they are optional hardening.

### `purgeExpiredSessions(db)`

```sql
DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP
```

Expired sessions are **already useless** — `readSession()` filters them out in SQL. So
this is a *storage* task: without it the table grows forever. Run it daily.

### `enforceSessionLimit(db, userId, maxSessions = 5)`

```sql
DELETE FROM sessions
 WHERE user_id = $1
   AND id NOT IN (
     SELECT id FROM sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
   )
```

The attack shape: an attacker with a stolen password signs in from hundreds of
machines, so that when the real user reports "someone keeps logging me out", it looks
like routine churn. A cap keeps them from hiding in the noise. Nice side effect:
evicting the *oldest* session is a free signal that something is wrong.

Neither of these is a substitute for the core mechanism. If you skip them, the app is
still secure — it just leaks disk or hides attackers.

---

## Verify it works — before touching any React

Do not start Chapter 4 until this passes. Debugging the layer below is much easier than
debugging it through a UI.

```bash
npm run server
```

```bash
# 1. Sign in. -i shows headers; -c saves the cookie to a jar.
curl -i -c jar.txt -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"secret123"}'
```

Expect `200`, and a header like:

```
Set-Cookie: sid=9f2a…c41b; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000
```

```bash
# 2. Prove the server remembers you.
curl -i -b jar.txt http://localhost:3001/api/auth/session     # → 200 { email }
```

```bash
# 3. Revoke it.
curl -i -b jar.txt -X POST http://localhost:3001/api/auth/logout

# 4. Prove revocation actually worked.
curl -i -b jar.txt http://localhost:3001/api/auth/session     # → 401  ← the point
```

Step 4 passing is the whole chapter. It is the difference between a UI that *believes*
you are logged in and a server that *knows*.

### If step 2 returns 401

Work down this list — it is ordered by how often each one is the culprit:

| # | Cause | How to confirm |
|---|---|---|
| 1 | `Set-Cookie` passed as a string, not an array | Look for one combined header in the curl output |
| 2 | Cookie `Path` does not match the original | Check `jar.txt` — the browser did not store it |
| 3 | `sessions` table missing | Server log shows an error on the login INSERT |
| 4 | Wrong port — hitting `:3001` from the browser | Bypasses the proxy; only matters for the browser, not curl |
| 5 | `expires_at` already past | `SELECT * FROM sessions;` |

---

## Checkpoint

1. Why store `sha256(token)` instead of the token, given the token is already random?
2. Why is `scrypt` right for passwords but not for session tokens?
3. What breaks if you set `Max-Age` to nothing?
4. `Set-Cookie` is passed as an array. Why not a comma-joined string?
5. `readSession()` returns `null` for five different situations. Why is that better
   than distinguishing them?
6. What is the practical difference between `purgeExpiredSessions` (a storage task) and
   a genuine security control?

Next: [Chapter 4 — client-side session state](4-client-side-session.md). Now the
interesting half: making React agree with what the server just told you.