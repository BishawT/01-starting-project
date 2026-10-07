# What Happens After Login — A JavaScript Tutorial

A hands-on tutorial for the code that runs **after** a user signs in.

Everything here is written against the real project in `../01-starting-project` (the
"ReactArt" app from the React Complete Guide), not a generic example. When a chapter
says "your `AuthInputs.jsx`", it means
`01-starting-project/src/components/AuthInputs.jsx`.

---

## The short version

Right now, "being logged in" in this app is a single boolean:

```js
const [isLoggedIn, setIsLoggedIn] = useState(false);   // AuthInputs.jsx:9
```

That is enough to *demo* a login form. It is not enough to build an app, because a
boolean in React state is a **claim**, not a **proof**. Anyone can set it. And a page
refresh throws it away.

This tutorial builds the real thing: a **server-side session** identified by an
**httpOnly cookie**, plus the React code that reflects that session in the UI.

---

## Prerequisites

You need to be comfortable with:

- `let` / `const`, functions, objects, arrays, `map`/`filter`
- `async` / `await` and what a `Promise` is
- ES modules: `import` / `export`
- React: `useState`, `useEffect`, and props

If `async`/`await` is shaky, read **Chapter 2** first. It is written for you.

---

## How to run the code in this tutorial

The snippets are real, commented JavaScript files. Read them like source, not like
copy-paste:

```
after-login-tutorial/
├── README.md                  ← you are here (index)
├── 1-the-mental-model.md
├── 2-javascript-you-need.md
├── 3-server-side-sessions.md
├── 4-client-side-session.md
├── 5-protected-routes.md
└── 6-logout-and-expiry.md
```

Supporting files:

```
after-login-tutorial/snippets/
├── database.sql               ← the sessions table
├── server/session.js          ← create / read / destroy sessions (node:http + pg)
├── server/app-additions.js    ← the exact edits to Database/app.js
├── client/useSession.js       ← the data-fetching hook, isolated
├── client/AuthContext.jsx     ← share "who am I" across the whole React tree
└── client/ProtectedRoute.jsx  ← block UI until we know who the user is
```

Snippets are named after the file they belong in, so the import paths inside them are
already correct. Reading them in this order works best: `useSession.js` (the one
request), then `AuthContext.jsx` (the shared state), then `ProtectedRoute.jsx`.

Every snippet has this header comment:

```js
// ─── PURPOSE ───────────────────────────────────────────────
// WHAT:   one sentence on what this file does.
// WHERE:  the file in the real project it belongs to.
// WHY:    the reason it exists.
// ───────────────────────────────────────────────────────────
```

The tutorial is **docs only** — no snippet file is imported by your app, and nothing
here will run on its own. The chapters tell you where each piece belongs when you are
ready to wire it up.

---

## Reading order

| # | Chapter | You will learn |
|---|---------|----------------|
| 1 | [The mental model](1-the-mental-model.md) | The four jobs that happen after login, and why your current code only does two of them. |
| 2 | [JavaScript you need](2-javascript-you-need.md) | The language features the rest of the tutorial assumes: Promises, `fetch`, closures, error handling. |
| 3 | [Server-side sessions](3-server-side-sessions.md) | The `sessions` table, the token, the `Set-Cookie` header, and why `HttpOnly` matters. |
| 4 | [Client-side session state](4-client-side-session.md) | `AuthContext`, why you must ask the server on every page load, and the double-render trap. |
| 5 | [Protected routes](5-protected-routes.md) | Why hiding a component is not protection, and the three states a guard must handle. |
| 6 | [Logout and expiry](6-logout-and-expiry.md) | Server-side destruction, cookie clearing, idle timeouts, and a security checklist. |

---

## Chapter 1 in one paragraph

A login is not an event. It is the *start* of a session. A session has to survive four
separate moments, and your current code handles zero of them on the server:

1. **Immediately after login** — swap the login form for the app. ✅ works today.
2. **On every later request** — prove *who* is asking. ❌ today the server never checks.
3. **On page reload / new tab / return tomorrow** — remember the user. ❌ today it forgets.
4. **On logout** — destroy the proof. ❌ today it just flips a boolean.

The whole tutorial exists to make (2), (3) and (4) real. Start with
[Chapter 1](1-the-mental-model.md).