# Chapter 6 — Logout, Expiry, and the Checklist

The last chapter, and the one that separates a demo from a product. Logout is where
"after login" turns back around — Job 4 from Chapter 1.

---

## Your current logout

```jsx
// src/components/AuthInputs.jsx:65-67
<button className="button" type="button" onClick={() => setIsLoggedIn(false)}>
  Sign Out
</button>
```

No request. No server involvement. Nothing is revoked, because nothing was ever issued
— the server has no idea you were signed in.

It *works*, for one reason: the only thing that changes is what this browser tab draws.
Click Sign Out and the form comes back. But nothing was destroyed. There is nothing to
destroy.

Compare with the real thing:

```js
// POST /api/auth/logout
const token = readCookie(request, SESSION_COOKIE_NAME);
if (!token || !SAFE_COOKIE_VALUE.test(token)) return;
await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);

sendJson(response, 200, { message: 'Signed out.' }, [buildExpiredSessionCookie()]);
```

**Two** actions, and you need both:

| Action | Without it |
|---|---|
| Delete the `sessions` row | The cookie still works. Re-login, still works. Shared device, still works. |
| Expire the cookie | The stale cookie keeps being *sent*; the browser just ignores a value it has deleted. |

Delete only one half and you get a bug that is genuinely hard to see: the user says
"Sign Out did nothing", you reload, they appear logged out again, and you conclude the
button is broken. Both halves, every time.

---

## Logout is POST, not GET

```js
'POST /api/auth/logout': 'logout',   // POST, not GET: logout changes state.
'GET /api/auth/session': 'session',  // GET: it only reads.
```

A `GET` must not change state. If logout were a `GET`, then any `<img src>`,
`<link rel=prefetch>`, or browser prefetch on a page containing that URL would sign
the user out. Worse, under `SameSite=Lax` a top-level `GET` navigation *does* carry the
cookie, so a hostile page could link to it and log the user out with one click. Keeping
destructive actions on `POST` is what makes `SameSite=Lax` sufficient here.

---

## The client side of logout

```js
// snippets/client/AuthContext.jsx → logout()
const logout = useCallback(async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Deliberately ignored. If the server is unreachable, the session still
    // dies on its own via expires_at, and refusing to hide the UI would
    // leave a user stuck on a broken screen with no way out.
    //
    // Note we do NOT put refresh() in this finally. If the logout request
    // never reached the server, the session may still be alive, and
  }                             // ← deliberately NOT in a `finally`

  // Only reached if the server did not throw, so the row is really gone.
  await refresh();
}, [refresh]);
```

### The design question buried in this function

If the network fails, should the user still see themselves as signed out?

**Yes.** Three reasons:

1. The user's *intent* was to log out. Honouring intent is the whole point of the
   button.
2. The session dies by itself at `expires_at` anyway.
3. Refusing to leave the page leaves someone on a shared or public computer with no
   way out — the worst possible outcome.

### Why `refresh()` is not in a `finally`

This is the subtle part, and getting it backwards is a real trap.

```js
// ❌ do not do this
try {
  await fetch('/api/auth/logout', { method: 'POST' });
} catch { /* ignore */ } finally {
  await refresh();
}
```

If the logout request never reached the server, the session is **still alive**.
`refresh()` then truthfully reports `SIGNED_IN`, and React puts the user back into the
signed-in state — a logout button that visibly does nothing, with no error shown.

So: `refresh()` only on the success path. `catch` swallows the error and lets React
move on optimistically; `refresh()` confirms the truth when there is a truth to
confirm.

| Network outcome | `refresh()` called? | Result |
|---|---|---|
| Server deletes the row | yes | Server confirms `SIGNED_OUT`. Correct. |
| Server unreachable | no | React shows signed out. Intent honoured; session expires anyway. |
| Request timed out, server actually processed it | yes | Server confirms `SIGNED_OUT`. Correct. |

Every row is right.

---

## Logout everywhere

Logout on one device is not logout everywhere — that is a *different, deliberate*
feature.

```sql
-- everywhere except the current device
DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2
```

```sql
-- everywhere, including this device
DELETE FROM sessions WHERE user_id = $1
```

Both should exist in a real product. "Sign out of all devices" is the feature people
reach for after they think their password has been stolen, and having to email support
is a bad experience.

Neither should be the *default* logout. Signing out on your laptop should not sign you
out on your phone — that is the behaviour of `destroySession()` in Chapter 3, and it is
deliberate.

---

## Session lifetime, and why 30 days is a choice

```sql
expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
```

| Lifetime | Good for | Cost |
|---|---|---|
| 1 hour | banking, anything high-stakes | constant re-login |
| 24 hours | admin tools, most apps | occasional re-login |
| 7–30 days | consumer apps | wider window if a token leaks |

There is no correct answer, only a trade-off: **longer means less friction and more
exposure.** 30 days is a common default for consumer apps.

The industry trend is worth knowing about, even though it is out of scope here:
**idle timeout plus absolute maximum**. Log out after 12 hours idle *and* after 30 days
absolute. Idle expiry limits the damage from a forgotten session on a shared laptop;
absolute expiry limits the damage from a token that leaked months ago and was never
noticed.

### Absolute expiry needs no code

The database already enforces it, because `readSession()` filters on
`expires_at > CURRENT_TIMESTAMP`. An expired row is invisible to the API even though
the row still exists. That is why `purgeExpiredSessions()` is a *storage* job and not
a security one.

### Idle expiry needs a write on every request

```js
// A sliding window: extend the deadline on each authenticated request.
await db.query(
  `UPDATE sessions SET expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days'
    WHERE token_hash = $1`,
  [hashToken(token)],
);
```

One caveat, and it is a real one: **sliding expiry only works if the cookie's
`Max-Age` is extended too**, otherwise the browser discards it at the original 30 days
regardless of what the database says. And writing on every request adds a round trip —
fine for this app, a real cost at scale.

---

## Securing the endpoints your app already has

Your current server has two gaps that a session system makes worth closing.

### 1. Rate-limit login attempts

Right now, `POST /api/auth/login` will happily answer forever. `scrypt` is slow, which
gives you *some* natural resistance — each attempt costs you real CPU — but there is no
limit.

```js
// Crude but effective: count failures from this IP in the last 15 minutes.
const { rows } = await db.query(
  `SELECT COUNT(*) AS failures FROM login_attempts
    WHERE ip = $1 AND attempted_at > NOW() - INTERVAL '15 minutes'`,
  [clientIp],
);
if (Number(rows[0].failures) > 10) {
  sendJson(response, 429, { message: 'Too many attempts. Try again later.' });
  return;
}
```

Two details:

- **Log failures, not just successes.** Count the `401`s, otherwise the attacker just
  gets one free guess per IP.
- **`429`, not `401`.** Rate limiting is not a credential failure; a distinct status
  code lets clients and monitoring tell them apart.

A production version wants a shared store — Redis, or a Postgres table — because an
in-memory counter resets on every deploy and does not work across multiple instances.

### 2. Do not reveal whether an account exists

Your code is already good here, and it is worth understanding why:

```js
// Database/app.js:116-119 — no such user
if (!user) {
  sendJson(response, 401, { message: 'Email or password is incorrect.' });
  return;
}

// Database/app.js:126-129 — wrong password
if (!passwordMatches) {
  sendJson(response, 401, { message: 'Email or password is incorrect.' });
  return;
}
```

**Identical status, identical message.** That prevents account enumeration — an
attacker cannot use the login form to discover which email addresses have accounts.

Two stronger habits for the same problem:

```js
// A: run the comparison even when the user does not exist
const DUMMY_SALT = 'a-fixed-salt-so-timing-matches';
const salt = user?.password_salt ?? DUMMY_SALT;
const { hash } = await hashPassword(password, salt);
const matches = user && timingSafeEqual(...);
```

Without this, a missing user returns *fast* (no `scrypt` call) and an existing one
returns *slow*. The status and message match, but the response time does not — and
timing is enough to enumerate accounts. This is what `timingSafeEqual` on line 122 is
protecting; doing the work regardless of whether the user exists is the rest of it.

```js
// B: say the same thing on register
sendJson(response, 409, { message: 'Account created. You can now sign in.' });
```

Your current `409` ("An account with this email already exists.") is a deliberate
trade-off: better UX for real users, at the cost of making registration an enumeration
oracle. Either choice is defensible. Just make it consciously.

---

## The production checklist

### Cookies

- [ ] **`HttpOnly`** — the whole reason for the cookie design. XSS cannot read it.
- [ ] **`SameSite=Lax`** — CSRF defence for POST endpoints.
- [ ] **`Secure`** in production — HTTPS only.
- [ ] **`Path=/`** — must match on delete, or logout silently fails.
- [ ] **`Max-Age`** set — or users are logged out whenever they close the browser.
- [ ] **Never** a custom cookie-signing secret. The token is random and stored hashed;
      there is nothing to sign.

### Server

- [ ] **`readSession()` on every authenticated route.** Not the important ones. Every
      one.
- [ ] **Identity from the session row**, never from the request body.
- [ ] **Ownership filtered in SQL** (`WHERE owner_id = $1`), not in JavaScript after
      fetching.
- [ ] **Same status and message** for unknown user and wrong password.
- [ ] **Rate-limit login.** Count failures.
- [ ] **Parameterised queries everywhere.** Never string concatenation.
- [ ] **`timingSafeEqual`** for password comparison — you have this (`app.js:122`).
- [ ] **Purge expired sessions** on a schedule.
- [ ] **Cap sessions per user** to stop mass-login noise.

### Client

- [ ] **`LOADING` is its own state.** No flicker in either direction.
- [ ] **`AbortController` + cleanup** on every fetching effect.
- [ ] **`401` treated as a normal answer**, handled before `!response.ok`.
- [ ] **Any `401` triggers a session refresh**, so revocation takes effect.
- [ ] **Nothing secret in `localStorage`.** No token, ever.
- [ ] **Server-provided identity** rendered, not form state.

### Deployment

- [ ] **HTTPS everywhere.** Required for `Secure` to be meaningful.
- [ ] **`Secure` cookie flag actually on** in production.
- [ ] **CORS origin exact**, and `Access-Control-Allow-Credentials: true` if the API
      ever moves off the proxy's origin.
- [ ] **`credentials: 'include'`** on every `fetch` if the API becomes cross-origin.
      This is the change that turns the current setup from easy to fiddly — keep the
      proxy if you can.
- [ ] **`NODE_ENV=production`** so `shouldUseSecureCookies()` returns `true`.
- [ ] **`DATABASE_URL` not committed.** Your `.gitignore` covers `.env`; verify it.

---

## Debugging reference

| Symptom | Most likely cause |
|---|---|
| Signed out after every reload | `useSession` effect missing, or `AuthProvider` not wrapping `<App>` |
| Signed-in user sees the login form on load | `LOADING` collapsed into `SIGNED_OUT` |
| Flash of the app for signed-out users | `<ProtectedRoute>` rendering during `LOADING` |
| Sign Out does nothing | Logout route not called, or `Set-Cookie` not sent back |
| Still signed in after Sign Out | Only one of the two logout halves implemented |
| Session works, then randomly fails | `Path` mismatch on the delete, or the cookie was not stored at all |
| Works in `curl`, fails in the browser | Hitting `:3001` directly and bypassing the `/api` proxy |
| API returns 200 with no data | Route not wrapped in `requireSession()` on the server |
| Sign Out does nothing after a failed request | `refresh()` is inside a `finally` — move it to the success path |
| `401` shows an error banner to visitors | The `401` check is after the `!response.ok` check |

---

## The whole thing, end to end

```
SIGN IN
  POST /api/auth/login { email, password }
    → scrypt + timingSafeEqual           (app.js:121-125, already correct)
    → INSERT INTO sessions (token_hash)  (hash only — never the token)
    → Set-Cookie: sid=…; HttpOnly; SameSite=Lax; Path=/
    → 200 { email, expiresAt }           (no secret in the body)
  client: await refresh()                (believe the server, not the form)
  client: status = SIGNED_IN             (set from the response, never guessed)

EVERY REQUEST AFTERWARDS
  Cookie: sid=…  →  sha256  →  SELECT … WHERE expires_at > NOW()
                   →  401, or the verified user row

PAGE RELOAD
  nothing survives →  GET /api/auth/session  →  200 / 401  →  state from the answer

REVOKED MID-SESSION
  next request 401 → SessionExpiredError → refresh() → SIGNED_OUT → redirect

SIGN OUT
  DELETE FROM sessions WHERE token_hash = $1    (this device only)
  Set-Cookie: sid=; Max-Age=0                  (same name and path!)
  client: refresh() → confirmed SIGNED_OUT
```

### The one sentence

> The client makes claims, the server verifies them, and React renders whatever the
> server last said — nothing more.

Your existing code already got the hardest parts right: `scrypt` with per-user salts,
`timingSafeEqual`, parameterised queries, identical error messages for unknown user and
wrong password. All that was missing was memory on the server, and the client-side
discipline to defer to it.

---

## Final checkpoint

1. Name the two things logout must do. What breaks if you do only one?
2. Why must logout be `POST` rather than `GET`?
3. Why is `refresh()` deliberately *not* in a `finally` block in `logout()`?
4. What is the difference between "sign out" and "sign out of all devices"?
5. Absolute expiry needs no new code — why not? What does it need?
6. Your `Delete` + `Max-Age=0` cookie has `Path=/api` but the original had `Path=/`.
   What happens on logout?
7. Your login response is `{ message: 'Email or password is incorrect.' }` with a
   `401`, in both the unknown-user and wrong-password cases. What attack does that
   prevent, and what timing side channel remains?
8. Why is `purgeExpiredSessions()` a maintenance job rather than a security control?

---

That is the whole tutorial. Go back to
[Chapter 3's verification steps](3-server-side-sessions.md) and get the curl sequence
passing before you write any React — the UI will not fix a server that has no memory.