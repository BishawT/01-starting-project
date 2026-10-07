# Chapter 1 — The Mental Model of "After Login"

## What you have right now

Open `src/components/AuthInputs.jsx` and follow the success path of a sign-in.

### Step 1 — The form validates itself

```js
// src/components/AuthInputs.jsx:12-14
const emailNotValid = submitted && !enteredEmail.includes('@');
const passwordNotValid = submitted && enteredPassword.trim().length < 6;
const isFormValid = enteredEmail.includes('@') && enteredPassword.trim().length >= 6;
```

These are **three booleans recomputed on every keystroke**. Because React re-runs the
whole component body after each `setEnteredEmail`, they are never stale — you do not
need `useEffect` or `useMemo` here. Keep this in your head, because Chapter 4 is
entirely about a case where the same trick *does not* work.

### Step 2 — The browser talks to the server

```js
// src/components/AuthInputs.jsx:34-39
const response = await fetch(`/api/auth/${mode === 'create' ? 'register' : 'login'}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await response.json();
```

Two things worth understanding here, because they explain why cookies "just work" in
this project:

- The URL is **relative** (`/api/auth/login`), not `http://localhost:3001/api/...`.
- `vite.config.js:10-12` proxies anything starting with `/api` to port 3001:

  ```js
  // vite.config.js:9-13
  server: {
    open: true,
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  ```

**Consequence:** as far as your browser is concerned, every API call is *same-origin*
with the page (`localhost:3000`). The server has to do the talking to port 3001. Later,
when we set a session cookie, the browser attaches it to these proxied requests
automatically — no `credentials: 'include'`, no CORS preflight. This is why the
`Access-Control-Allow-Origin` header in `Database/app.js:41` is actually redundant in
this setup. Leave it; it does no harm.

### Step 3 — The server answers with an email and nothing else

```js
// Database/app.js:131
sendJson(response, 200, { email: user.email });
```

**This is the most important line in the whole flow.** The server returns your email.
It does *not* return a session id, a token, a cookie, or any other proof that you are
who you say you are. The request is over. The connection is closed. The server has
forgotten everything about you.

### Step 4 — The client promotes a claim into "logged in"

```js
// src/components/AuthInputs.jsx:52
setIsLoggedIn(true);
```

```js
// src/components/AuthInputs.jsx:61-70
if (isLoggedIn) {
  return (
    <div id="auth-inputs" className="auth-message">
      <p>You are signed in as {enteredEmail.trim().toLowerCase()}.</p>
      <button className="button" type="button" onClick={() => setIsLoggedIn(false)}>
        Sign Out
      </button>
    </div>
  );
}
```

Note where the email on screen comes from: `enteredEmail`, the **form field**. Not from
the server response. If someone wanted to, they could type any email, press Sign In,
and the UI would happily say "You are signed in as ceo@example.com".

---

## The problem, stated precisely

`isLoggedIn` is a **claim**. Your UI believes the claim and renders accordingly. But:

- **It is not proof.** The client asserts it; nothing verifies it.
- **It does not survive a reload.** It lives in `useState`. Reload the page, React
  restarts with `false`. The user "gets logged out" every time they hit F5.
- **It does not reach the server.** Try it: log in, then open a second tab to
  `/api/auth/...`. Nothing about that request says you are signed in.
- **"Sign Out" only hides the UI.** `setIsLoggedIn(false)` changes nothing on the
  server, because the server never knew in the first place.
- **Anyone can edit it.** Open DevTools → Sources → `Pause on exceptions`, or just open
  the React DevTools panel, and flip the checkbox. The app now "believes" you are
  anyone.

None of this is a mistake — this is what course-sized auth code looks like on purpose.
The server code is already solid: `scrypt` hashing with a per-user salt
(`app.js:67-70`) and `timingSafeEqual` for comparison (`app.js:122-125`) so that
response timing does not leak whether the password was close. The *session* layer is
simply the missing piece.

---

## The four jobs of "after login"

An app that handles login properly does all four. Let's name them, because each later
chapter attacks exactly one.

### Job 1 — Swap the UI

*Chapter 4.* React stops rendering the form and renders the app instead.

**You already do this** with the `if (isLoggedIn)` branch. The only change is *what*
gates the branch.

### Job 2 — Prove identity on every request

*Chapter 3.* Every single API call after login must be attributable to a specific user.

**You do not do this at all.** The server cannot answer "who is this?" because it has
no record of the exchange. We fix this with a server-side **session** row and a cookie
holding its id.

### Job 3 — Survive a reload

*Chapter 3 & 4.* On a fresh page load, the client must be able to ask "am I still
signed in?" and get an answer from the server.

**You do not do this.** This is the one users notice most.

### Job 4 — Be able to revoke

*Chapter 6.* Logout must destroy the proof server-side, not just hide the UI.

**You do not do this.** This is the one attackers notice most.

---

## The target design

```
BROWSER                          SERVER                        DATABASE
───────────────────────────────────────────────────────────────────────────────
type email + password
      │
      │ POST /api/auth/login
      │ { email, password }
      ▼
                          verify password (scrypt
                          + timingSafeEqual)
                          ├── INSERT INTO sessions
                          │     (token_hash, user_id,
                          │      expires_at)
                          │
                          └── Set-Cookie: sid=<token>;
                              HttpOnly; SameSite=Lax; Path=/
      ▲                                  │
      │ 200 { email }                    │
      │ (plus cookie the browser stored)
      │
setIsLoggedIn(true)
render the app
      │
      │ ── page reload, next day, new tab ──
      │
      │ GET /api/auth/session
      │ Cookie: sid=<token>   ───────────►  hash it, look up session,
      │                                        check expires_at
      │ ◄────────── 200 { email, expiresAt } ──┘   (or 401, if gone)
      │
React sets state from the ANSWER,
not from the form field.
```

Two design decisions in that diagram, and both matter:

### The token is random, and it is not the session id

The cookie carries a 32-byte random string. The database stores a **hash** of that
string, not the string itself.

```js
// ✅ how it should look
const token    = randomBytes(32).toString('hex');  // goes in the cookie
const tokenHash = sha256(token);                    // goes in the database
```

**Why?** Because someone can read your database. If the table stored raw tokens, a
stolen database backup would hand an attacker every live session, instantly, with no
further work. If it stores only hashes, the attacker gets values that cannot be
converted back into working cookies. Defence in depth — the same instinct as hashing
passwords with `scrypt`, which your `hashPassword()` already applies.

Note the contrast in cost: a password can be deliberately slow to hash (scrypt is
*designed* to be slow, so guessing is expensive), whereas a session token is already
128 bits of pure randomness — there is nothing to guess. A single fast SHA-256 is
exactly right for it, and it keeps every request cheap.

### The cookie is `HttpOnly`, so JavaScript cannot read it

```js
'HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000'
```

`HttpOnly` means no `document.cookie` access from any script on the page. That means an
XSS bug — say someone gets `innerHTML` of unescaped user content — **cannot** walk away
with your session token.

If instead you follow the common beginner pattern of storing the token yourself:

```js
localStorage.setItem('token', data.token);   // don't do this
```

then that same XSS bug becomes a complete account takeover, because the token is just a
string sitting in a global object waiting to be read. The cookie approach removes that
entire class of bug. This is the single strongest reason for the cookie design, and it
is worth internalising before Chapter 3.

---

## Checkpoint

Before continuing, you should be able to answer these without looking back:

1. What single line makes this app "logged in", and why is it not proof?
2. Why does the code use a relative `/api/...` URL rather than a full `localhost:3001` URL?
3. The server returns `{ email }` and nothing else. What is missing?
4. Which is worse: forgetting a user on reload, or a logout that doesn't revoke?
   (Answer: the second. But you need both.)

Next: [Chapter 2 — the JavaScript you'll rely on](2-javascript-you-need.md).