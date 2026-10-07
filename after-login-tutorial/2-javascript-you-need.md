# Chapter 2 — The JavaScript You'll Rely On

Five language features carry the entire post-login system. Each is explained here from
first principles, then connected to the actual project code so you can see it in
context.

---

## 1. Promises and `async`/`await`

### The problem

Reading a file, hitting a database, calling an API — none of these finish instantly.
JavaScript is single-threaded, so it cannot simply *stop and wait*; that would freeze
the entire page, including the animations and buttons the user is trying to click.

So the language gives you a **placeholder object** that settles later.

### A Promise, concretely

```js
// A Promise has exactly three possible states.
const p = new Promise((resolve, reject) => {
  resolve('done');   // ✅ fulfilled  — carries a value
  // reject(new Error('boom'));  // ❌ rejected  — carries a reason
  // (never calling either)     // ⏳ pending   — still running
});
```

A Promise settles **once**. Try to `resolve()` then `reject()` on the same promise and
the second call is silently ignored — a promise is a one-shot firework, not a light
switch.

### `async`/`await` is just prettier Promises

```js
// Sugar: all three statements are identical in behaviour.
const a = await somePromise();
const b = await somePromise().then((value) => value + 1);
const c = await somePromise().then((value) => {
  throw new Error(value);
});
```

The crucial rule, and the one beginners always trip on:

> **`await` can only be used inside an `async` function.**

```js
// ❌ SyntaxError: await is only valid in async functions
const response = await fetch('/api/auth/session');
```

```js
// ✅
async function loadSession() {
  const response = await fetch('/api/auth/session');
}
```

### `await` is `try`-able — and you always need `finally`

`await` is where your failure modes appear. A network request fails, the server is
down, the JSON is malformed. Every await deserves a `try`/`catch`.

Look at how `AuthInputs.jsx` does it, because the pattern is good:

```js
// src/components/AuthInputs.jsx:31-58
setIsSubmitting(true);              // 1. "loading" flag ON

try {
  const response = await fetch(`/api/auth/${mode === 'create' ? 'register' : 'login'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();

  if (!response.ok) {
    setMessage(data.message || 'Unable to complete your request.');
    return;                        // 2. early return = happy path skipped
  }

  if (mode === 'create') {
    setMode('login');
    setEnteredPassword('');
    setSubmitted(false);
    setMessage(data.message);
  } else {
    setIsLoggedIn(true);
  }
} catch {
  setMessage('Cannot reach the authentication server. Start it with npm run server.');
} finally {
  setIsSubmitting(false);          // 3. "loading" flag OFF — always
}
```

Three lessons in one block:

**(a) `finally` runs no matter what.** Success, failure, or early `return` — the flag
resets. This is why the submit button never gets stuck forever on "Please wait…". If
you had put `setIsSubmitting(false)` at the end of `try` instead, any network error
would leave the form permanently frozen.

**(b) There are two different kinds of failure.**
- `!response.ok` → the server *worked* and said "no" (401 wrong password). You got a
  useful `data.message`.
- `catch` → the server was never reached at all (down, wrong port, DNS). The `catch`
  parameter is ignored here, which is fine, but note that **a real network failure also
  produces no useful message**, so the copy has to supply its own.

**(c) `fetch` does not reject on HTTP errors.** This surprises everyone. `fetch`
resolves happily with a `404`. You must check `response.ok` yourself, which is exactly
what line 41 does.

> **Why does `AuthInputs.jsx:54` write `catch {` with no parameter?**
> Because optional catch binding is valid modern JS — omit the parameter when you do
> not need the error. But sometimes you *do*: `app.js:133` writes
> `error instanceof SyntaxError` to tell a malformed body apart from a database
> failure. Bind the parameter when you need the reason:
> `catch (error) { ... }`.

---

## 2. `fetch`, and why the cookie comes for free

### The three-state result

```js
async function callApi(path) {
  let response;                    // stage 1: did we reach the server?

  try {
    response = await fetch(path);  // may throw
  } catch (networkError) {
    // never reached the server, or the request was aborted
    throw new Error('Network unreachable');
  }

  if (!response.ok) {              // stage 2: the server answered, but unhappy
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${response.status}`);
  }

  return response.json();          // stage 3: the happy path
}
```

That middle `.catch(() => ({}))` matters. If a 500 response has an HTML error page
instead of JSON, then `response.json()` **throws**. Without the guard, your nice error
handling collapses into a confusing `SyntaxError: Unexpected token <`. A thrown error
always means *give up*, so it needs its own fallback. This pattern appears throughout
Chapter 3's server code.

### Cookies attach themselves — but only in some situations

This is the rule that trips people up:

| Situation | Cookie sent? | What you must do |
|---|---|---|
| Request to the same origin | ✅ yes | nothing |
| Request to a *different* origin | ❌ no | `credentials: 'include'` **and** server CORS headers with `Access-Control-Allow-Credentials: true` |
| Same-site, cross-origin (subdomain) | depends on `SameSite` | `SameSite=None; Secure` |

**Your project is in row one.** `vite.config.js` proxies `/api` to port 3001, so the
browser only ever sees `localhost:3000`. The session cookie is set by that same apparent
origin, so it is sent on every request without any special code. If you ever deploy the
API to a separate domain, all of that changes — and it changes at the *server* too,
because `SameSite=None` cookies are rejected without `Secure` (i.e. HTTPS).

---

## 3. Closures — why `useState` works

A **closure** is a function that remembers the variables from where it was created.

```js
function makeCounter() {
  let count = 0;                  // lives inside this call's scope
  return () => ++count;           // the returned arrow keeps `count` alive
}

const next = makeCounter();
next();  // 1
next();  // 2   ← state persisted between calls
```

`count` is unreachable from outside. The arrow function is the only thing that can see
it. That is exactly the mechanic behind `useState`:

```js
const [isLoggedIn, setIsLoggedIn] = useState(false);
```

- `isLoggedIn` is a **snapshot** of the variable for this render.
- `setIsLoggedIn` is a **closure** over the setter that lives in React's internal memory.
- React calls the component again after you call it, producing a fresh snapshot.

### The consequence that causes the most bugs

**State is a snapshot, not a variable.** These two variables do **not** track each
other:

```js
function Broken() {
  const [count, setCount] = useState(0);
  const doubled = count * 2;        // ← uses THIS render's count

  function onClick() {
    setCount(count + 1);            // schedules a new render
    console.log(doubled);           // ← still 0! This closure saw count = 0
  }
}
```

Never "watch" one piece of state from inside a handler that updates it. Use the
**functional** form, which receives the latest value:

```js
setCount((current) => current + 1);
```

This is precisely what `switchMode` already does in your app:

```js
// src/components/AuthInputs.jsx:17
setMode((currentMode) => (currentMode === 'login' ? 'create' : 'login'));
```

Both forms are correct there because no other code in that handler reads `mode`. Know
when it matters.

> **Event handlers are not closures over mutable memory.** They are frozen at render
> time. `useEffect`'s cleanup functions in Chapter 4 are the same mechanism, and the
> same trap.

---

## 4. `useEffect` and cleanup — the thing that bites everyone

`useEffect` runs **after** render, and React guarantees it re-runs when its
dependencies change. For data fetching you need three things:

1. **Run it.**
2. **Cancel it if the inputs change or the component unmounts**, or you will write to
   dead state and trigger React's "can't perform a state update on an unmounted
   component" style warnings and, worse, race conditions.
3. **Not run it twice.** React 18+ in development deliberately double-invokes effects in
   `StrictMode` to surface exactly these bugs. `src/main.jsx` currently has **no**
> `StrictMode`, so you will not see it — which means if you later add `StrictMode` and
   suddenly get two requests, that is not a regression. It is the bug finally surfacing.

`AbortController` is the fix, and it belongs in every fetching hook you write. See
`snippets/client/useSession.js` for the fully commented version. The shape:

```js
useEffect(() => {
  // The browser object that can cancel this request for us.
  const controller = new AbortController();

  async function fetchSession() {
    const response = await fetch('/api/auth/session', {
      signal: controller.signal,          // ← hand the signal to fetch
    });
    if (response.status === 401) return;   // signed out is a normal answer
    if (!response.ok) throw new Error('Request failed');
    setUser(await response.json());
  }

  fetchSession().catch((error) => {
    // An abort is *expected* control flow, not an error to report.
    if (error.name === 'AbortError') return;
    setError(error);
  });

  // Cleanup: runs before the next run and on unmount.
  return () => controller.abort();
}, [dependencies]);
```

Three details worth memorising:

- **`signal`** is what wires the controller to `fetch`. Without it, `abort()` does
  nothing.
- **`AbortError`** must be swallowed. React aborts the previous request *every time* the
  dependency array changes, so aborts are normal, not exceptional.
- **The cleanup function is the return value** of `useEffect`. Arrow function with an
  implicit return: `() => controller.abort()`.

---

## 5. Modules: `import` is a live, hoisted binding

Two import details specific to this tutorial:

### `import.meta.url` — the server already uses it

```js
// Database/app.js:4, 12
import { fileURLToPath } from 'node:url';
...
process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
```

`import.meta.url` is the absolute `file://` URL of the current module. It is how a
server-side module finds its own folder without depending on the shell's working
directory. Your `npm run server` script relies on this to locate `Database/.env`.

### Default vs named exports

```js
// one thing, unnamed binding:
export default function AuthInputs() {}

// several named things:
export { createSession, readSessionCookie, destroySession };
```

Your components all use `export default` (`AuthInputs.jsx:3`, `Header.jsx:3`), which is
why they are imported as `import AuthInputs from './components/AuthInputs.jsx'`. The
server utility file in `snippets/server/session.js` uses **named** exports, because a
module of independent helpers reads better that way and keeps `Database/app.js` clean.

### Import order is hoisted

ES module imports are hoisted to the top of the module and evaluated before any
statements run. So this works, even though `pool` is used inside a function defined
before the import's line would execute:

```js
import { Pool } from './db.js';   // runs first, whatever order it appears in
const db = new Pool();
```

It is still poor style — keep imports at the top, where they belong.

---

## 6. ES modules need a file extension

Node's ES module loader is strict. This matters if you write any `.js` files alongside
the snippets:

```js
import { createSession } from './session.js';    // ✅ extension required
import { createSession } from './session';      // ❌ ERR_MODULE_NOT_FOUND
```

`"type": "module"` in your `package.json:5` is what puts Node into ES module mode, and
it is why your server can use `import`/`export` at all.

---

## Checkpoint

Quick self-test. Answer in one or two sentences each:

1. Why does `fetch` need `response.ok` checked manually?
2. Your `setIsSubmitting(false)` is inside `finally`. What breaks if it moves to the
   end of `try`?
3. Which cookie situation requires `credentials: 'include'`? (And does this project
   need it?)
4. Why can't `useState` be watched from inside the handler that updates it? What's the
   fix?
5. What is the cleanup function of `useEffect`, and what does `controller.abort()`
   actually protect you from?

Next: [Chapter 3 — server-side sessions](3-server-side-sessions.md).