# Chapter 4 — Client-Side Session State

Chapter 3 gave the server a memory. This chapter makes React **agree** with it.

**Files for this chapter:** `snippets/client/useSession.js`,
`snippets/client/AuthContext.jsx`

---

## The problem this chapter solves

You have a session cookie. The browser sends it automatically. So what does React
actually need to do?

Exactly one thing: **ask, once per page load, and believe the answer.**

That sounds trivial, and the trap is that it is not. Two specific mistakes make this
harder than it looks, and both are invisible in small apps.

---

## Mistake 1 — using the form field as the source of truth

This is what your app does today:

```js
// src/components/AuthInputs.jsx:52
setIsLoggedIn(true);
```

```js
// src/components/AuthInputs.jsx:64
<p>You are signed in as {enteredEmail.trim().toLowerCase()}.</p>
```

The email on screen comes from `enteredEmail` — the **text input**. Not from the
server's response, which also contained `{ email }` and was thrown away.

This means the displayed identity is whatever is in the box. It also means the
post-login truth is a claim. The fix is to re-ask after login:

```js
// snippets/client/AuthContext.jsx → login()
await refresh();
```

That one line is the difference between "the form says I'm logged in" and "the server
confirmed I'm logged in".

### Why not just use the response body?

The login response *does* contain `{ email }`. You could do
`setUser(data.email)` and skip the refetch. Why bother with the extra round trip?

Three reasons:

1. **It does not prove anything.** You already had `email` in the form. Setting state
   from the login response is the same claim, just from a different source.
2. **There is a second session path.** The user may have signed in in another tab, or
   the cookie may have been refreshed. `refresh()` asks "what is true *now*".
3. **It is the only way to catch an instantly-revoked session.** If an admin logged the
   user out from another device microseconds after login, only a fresh read gets it
   right.

One extra request per sign-in is a cheap price for being correct. This is also why
`login()` calls `refresh()` *after* the response arrives, and not before: the cookie
only exists once the browser has processed the `Set-Cookie` header.

---

## Mistake 2 — forgetting that a reload starts from zero

On a fresh page load there is no `isLoggedIn`, no `enteredEmail`, no React state at
all. The only things that survive are in the browser or the server — and right now,
that is the cookie and the `sessions` row. The client has to bootstrap itself from
the server, and that means an effect.

```js
// snippets/client/useSession.js
useEffect(() => {
  const controller = new AbortController();
  fetchSession(controller.signal);
  return () => controller.abort();
}, [fetchSession]);
```

---

## Three states, not two

```js
// snippets/client/useSession.js
export const SessionStatus = {
  LOADING: 'loading',      // in flight; we do not know yet
  SIGNED_IN: 'signedIn',
  SIGNED_OUT: 'signedOut',
};
```

This is the single most consequential decision in the chapter, so here is the argument
for it.

With only a boolean:

```js
const [isLoggedIn, setIsLoggedIn] = useState(false);   // 'signed out' AND 'asking'
```

During the initial request there is a window — however brief — where the honest answer
is "I don't know yet", and you are forced to answer with one of your two states. Both
choices are wrong:

- Render the login form → **every signed-in user sees the login form flash on load.**
  This is the classic "my app forgets I'm logged in" flicker.
- Render the app → signed-out users see a flash of the app, then get yanked to the
  login form.

So:

```js
// snippets/client/AuthContext.jsx
const isLoading = status === SessionStatus.LOADING;
const isSignedIn = status === SessionStatus.SIGNED_IN;
```

and consumers branch three ways. Every guard in the tutorial does this.

---

## Handle 401 as a normal answer

```js
// snippets/client/useSession.js
if (response.status === 401) {
  setUser(null);
  setStatus(SessionStatus.SIGNED_OUT);
  return;                       // ← returns before the !response.ok check
}

if (!response.ok) {
  throw new Error(`Could not load session (HTTP ${response.status}).`);
}
```

The order matters. A signed-out visitor is the *expected* state of a fresh browser, so
`401` is not an error condition — but it must be checked **before** `!response.ok`,
which would otherwise throw and show a red banner to every logged-out visitor.

And the reverse is just as important: a real failure gets `throw`, not a silent
`signedOut`. If the server were down and you set `SIGNED_OUT` on any error, your
symptom would be "users mysteriously get logged out" and your debugging session would
start in entirely the wrong place.

```js
} catch (caught) {
  if (caught.name === 'AbortError') return;   // expected control flow, not a failure
  setUser(null);
  setStatus(SessionStatus.SIGNED_OUT);
  setError(caught);                            // ← but keep the reason
}
```

`AbortError` must be swallowed, because React aborts the in-flight request every time
the effect re-runs. An abort is the system working, not a problem.

---

## No `credentials` option needed — and why

A very common tutorial says you must add this to every request:

```js
fetch('/api/session', { credentials: 'include' });   // ❌ not needed in THIS project
```

You only need `credentials: 'include'` when the request goes to a **different origin**
than the page. `vite.config.js:10-12` proxies `/api` to `http://localhost:3001`, so
from the browser's perspective the request is to `localhost:3000` — the same origin as
the page. The browser attaches the cookie on its own.

**This matters because it is fragile.** The moment you deploy the API to
`api.yourapp.com`, you must add `credentials: 'include'` to every call *and* configure
CORS with `Access-Control-Allow-Credentials: true` and a specific origin (wildcards are
rejected when credentials are involved). Chapter 6's checklist covers it. For now, note
the reason so the future you is not confused.

---

## Two sources of truth

The mistake that costs the most time. You now have session knowledge in **two** places:

| Location | Lifetime |
|---|---|
| `AuthContext` state | this page load |
| `sid` cookie + `sessions` row | 30 days, or until logout |

They can disagree, in one direction only: **the cookie outlives React state.**

- User logs out in another tab → the row is gone, React still thinks signed in.
- Admin revokes a session → same.
- 30 days pass → cookie expired, React alive.

React cannot poll for this. But the API *can* tell React, and the correct pattern is to
treat any `401` from any authenticated request as authoritative — see Chapter 5 for the
wrapper that does this:

```js
// snippets/client/ProtectedRoute.jsx → useAuthenticatedFetch()
const response = await fetch(url, options);

if (response.status === 401) {
  // The server disagrees with our state. The server is right.
  setStatus(SessionStatus.SIGNED_OUT);
  setUser(null);
}
```

**Rule: the server is always right, and React state is a cache of it.** Every time you
catch yourself writing `setUser(...)` from anything other than a server response, stop
and ask where the proof came from.

---

## Context, and why `useMemo` is not optional

```js
const value = useMemo(
  () => ({ user, status, error, isLoading, isSignedIn, isSubmitting, login, logout, refresh }),
  [user, status, error, isLoading, isSignedIn, isSubmitting, login, logout, refresh],
);

return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
```

Context re-renders every consumer whenever the **value's identity** changes. Without
`useMemo`, the object literal above is a brand-new object on every render, so its
identity always changes, so every consumer re-renders on every render of `AuthProvider`.
You have made Context *slower* than props.

With `useMemo`, the object is stable unless a real dependency changes.

### The classic `useMemo` bug

The dependency array must list everything referenced inside. Miss one and the value
silently stays stale after it changes — the worst kind of bug, because it works until
the day it does not. If you see stale context values, check the dependency array first.

### Why not a module-level variable?

You may have thought of this instead:

```js
// ❌ do not do this
let currentUser = null;
```

It looks like it "works" — every module can import it. But: no re-render is triggered
when it changes, so the UI goes stale; it cannot be reset per-request; and it breaks
entirely with server rendering. `useState` inside a Provider is the supported
mechanism, and `useState` is what notifies React.

---

## Default value = loud failure

```js
const AuthContext = createContext({
  // ...
  login: async () => {
    throw new Error('useAuth() used outside <AuthProvider>.');
  },
});
```

`createContext` runs at module load, so this object exists before anything renders.
Without it, a component that forgets the provider silently reads `user: null` and
renders the login form forever, with no error anywhere. Making the default
obviously-wrong converts a silent bug into an immediate, explanatory one.

---

## Wiring it up

```jsx
// src/main.jsx
import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
```

`AuthProvider` goes **outside** `<App />`, so every descendant can consume it.

### About `StrictMode`

Your `main.jsx` does not use `<StrictMode>` today. Add it eventually — but know what
happens when you do: React 18+ runs effects **twice** in development to surface missing
cleanups and side effects during render. You will see two `/api/auth/session` requests.
The first is aborted by the cleanup function and its `AbortError` is swallowed, so this
is expected and harmless.

**Do not** "fix" it with a `hasFetched` ref guard. That suppresses the symptom and hides
the actual bug `StrictMode` is trying to teach you.

---

## Verifying it works

With the server endpoints from Chapter 3 verified via curl:

1. **Reload survives** — sign in, press F5. You stay signed in. This is Job 3, and it
   is the change users notice most.
2. **A second tab agrees** — sign in, open a new tab to `localhost:3000`. It also shows
   you signed in, because it asked the server.
3. **The name comes from the server** — DevTools → Network → `/api/auth/session` →
   Response. Compare it to what is on screen. They match, and it is the server's copy.
4. **Logout revokes** — sign out, then reload. You stay out.
5. **No flicker** — with a session, reload and watch. The app must never briefly show
   the login form. If it does, you collapsed `LOADING` into `SIGNED_OUT`.
6. **No flicker the other way** — with no session, reload. The login form appears
   immediately, with no flash of the app.

Test #5 and #6 on a throttled connection: DevTools → Network → Slow 3G. The `LOADING`
state exists precisely for this, and fast wifi hides the bug.

---

## Checkpoint

1. Why is `enteredEmail` the wrong source for the displayed identity? Cite the line.
2. Why call `refresh()` after login rather than setting state from the login response?
3. What is wrong with `const [isLoggedIn, setIsLoggedIn] = useState(false)` here, given
   the initial request takes real time?
4. Why must the `401` check come before the `!response.ok` check?
5. Why is `credentials: 'include'` unnecessary here — and what would have to change for
   it to become necessary?
6. What breaks if you drop `useMemo` from the context value?
7. Your session row was deleted by a cron job while the tab was open. Which piece of
   code is responsible for reconciling React with reality, and where does it live?

Next: [Chapter 5 — protected routes](5-protected-routes.md).