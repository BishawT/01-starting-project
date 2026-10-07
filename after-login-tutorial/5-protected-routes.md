# Chapter 5 — Protected Routes

Chapter 4 made React agree with the server at page load. This chapter keeps them
agreeing when the server changes its mind mid-session.

**Files for this chapter:** `snippets/client/ProtectedRoute.jsx`

---

## The thing to understand first

> **Client-side route guards are UX, not security.**

They are worth having — a signed-out user should not see a flash of the app. But they
protect nothing, and it matters that you know why:

- Everything that actually matters happens on the server.
- Someone can delete `<ProtectedRoute>` from your JSX and nothing becomes less secure.
- The bundle is public. Anyone can read your JS, see what guards exist, and ignore
  them. A guard is a suggestion to your own UI, not a lock on the door.

So this chapter has two halves, and they are **not equally important**:

| | What it does | How much it matters |
|---|---|---|
| `<ProtectedRoute>` | Hide the app from people who cannot use it | convenience — UX |
| `requireSession()` on the server | Refuse to do the work | security |

If you only remember one thing from this chapter, make it the second row.

---

## If you have no router

Your project has no routing yet — `App.jsx` renders `<Header />` and `<AuthInputs />`
unconditionally. So there is nothing to guard *yet*.

Two honest options:

**Option A — keep it a single page (start here).** Have `AuthInputs` read the context
and render the signed-in view from `user.email` instead of `enteredEmail`. You get all
four jobs from Chapter 1 with zero new dependencies. Do this first; it teaches
everything except routing.

**Option B — add `react-router-dom` and do it properly.**

```bash
npm install react-router-dom
```

Then the `<ProtectedRoute>` component in the snippet file is exactly what you need.
The rest of this chapter applies unchanged.

Either way, **do not add a router just to learn this chapter.** The mental model is
router-independent.

---

## The component

```jsx
// snippets/client/ProtectedRoute.jsx
export default function ProtectedRoute({ children, fallback = null }) {
  const { status, isSignedIn } = useAuth();
  const location = useLocation();

  if (status === SessionStatus.LOADING) {
    return fallback;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
```

Three branches, and the first one is the point of the whole chapter.

### Branch 1 — `LOADING`: render nothing

You do not know yet. Rendering the login form here is the flicker. Rendering the app
is worse: signed-out users get a flash of content they should not see, and then a
yank. `fallback` (a spinner, or `null`) is the honest answer to "I don't know yet".

This is Chapter 4's three-state rule showing up in the guard itself.

### Branch 2 — redirect, and remember where they were going

```jsx
<Navigate to="/login" replace state={{ from: location }} />
```

- **`replace`** — replaces the current entry in history instead of pushing a new one.
  Without it, clicking Back after signing in bounces the user to the page that
  bounced them to login, forever. This is a genuinely maddening bug and `replace` is
  the one-word fix.
- **`state={{ from: location }}`** — remembers the original destination. Without it,
  deep-link → login → home loses the user's place, which is the kind of small betrayal
  users remember. Read it back after login:

  ```jsx
  const location = useLocation();
  const navigate = useNavigate();

  async function handleSubmit(email, password) {
    await login(email, password);
    navigate(location.state?.from?.pathname ?? '/', { replace: true });
  }
  ```

  `location.state?.from?.pathname` uses **optional chaining**, because `state` is
  `null` when the user navigated to `/login` directly rather than being redirected.

### Branch 3 — signed in, render the real thing

```jsx
return children;
```

Notice there is no `else` and no nested `if`. Early returns beat nesting here; three
flat branches are easier to read and impossible to mis-nest.

---

## The mirror image: keep signed-in users off the login page

The most annoying auth bug: sign out, press Back, land on a login form you already
filled in.

```jsx
function OnlyWhenSignedOut({ children }) {
  const { status, isSignedIn } = useAuth();

  if (status === SessionStatus.LOADING) return null;
  if (isSignedIn) return <Navigate to="/" replace />;
  return children;
}
```

Same three branches, inverted. Any real app wants both.

---

## The part that actually matters

Now the security half. `<ProtectedRoute>` stops your UI from flashing; it stops
nothing else. This is what does.

### Server side

```js
// Database/app.js
async function requireSession(request, response, db, handler) {
  const session = await readSession(db, request);

  if (!session) {
    // No reason given. "No session" and "expired session" must look identical
    // to an attacker (Ch. 3).
    sendJson(response, 401, { message: 'Please sign in.' });
    return null;
  }

  await handler(session);
  return session;
}
```

```js
if (route === 'upload') {
  await requireSession(request, response, db, async (session) => {
    const result = await db.query(
      'INSERT INTO uploads (owner_email, title) VALUES ($1, $2) RETURNING id',
      [session.email, title],
    );
    sendJson(response, 201, { id: result.rows[0].id });
  });
  return;
}
```

**Every authenticated endpoint needs this.** Not the important ones — every one. The
endpoint nobody thought needed protection is the one somebody finds.

### The structural point that actually matters

```js
session.email   // ← from the database row matched by the session token
title           // ← from the request body
```

`session.email` comes from the `users` row that your `sid` cookie matched. It is not
from a body field, a query parameter, or a header the client chose. That is what stops
user A from uploading as user B:

```js
// ❌ never do this — the client decides whose data this is
const result = await db.query(
  'INSERT INTO uploads (owner_email, title) VALUES ($1, $2)',
  [request.body.ownerEmail, title],
);
```

Any identity that originates from the client is a suggestion. Remember the pattern
from Chapter 1: **the client makes claims, the server verifies them.**

### Never trust the client to enforce ownership

The strongest version of this rule is to filter in SQL, not in JavaScript:

```sql
SELECT * FROM uploads WHERE owner_email = $1 AND id = $2
```

Compare with `SELECT * FROM uploads WHERE id = $2` followed by a JavaScript `if`. The
first is a single query that cannot be raced. The second works until someone forgets
the check on a new endpoint — and authorization bugs live in the gaps between
endpoints, not in the one you remembered.

---

## Handling mid-session revocation

The stale-state problem from Chapter 4, and the fix. React thinks you are signed in;
the server disagrees. That happens when someone logs you out in another tab, or an admin
revokes the session, or it expires.

React cannot poll for this. But every request it makes can report back:

```js
// snippets/client/ProtectedRoute.jsx → apiFetch()
if (response.status === 401) {
  throw new SessionExpiredError(response);
}
```

```js
// → useAuthenticatedFetch()
try {
  return await apiFetch(url, options);
} catch (error) {
  if (error instanceof SessionExpiredError) {
    await refresh();          // React now agrees with the server
  }
  throw error;
}
```

`refresh()` re-asks `/api/auth/session`, gets a truthful `401`, and flips status to
`SIGNED_OUT`. `<ProtectedRoute>` sees the new status and redirects. The chain:

```
server revokes session
      ↓
next request returns 401
      ↓
apiFetch throws SessionExpiredError
      ↓
useAuthenticatedFetch calls refresh()
      ↓
/api/auth/session → 401 → status = SIGNED_OUT
      ↓
<ProtectedRoute> renders <Navigate to="/login" />
```

The user is bounced out at the moment their next action fails, not at some arbitrary
later point. That is the correct behaviour, and it is entirely server-driven.

### Two subtleties

**Do not show an error message.** The user did nothing wrong; their session expired.
`<ProtectedRoute>` is already redirecting them. Setting an error gives them a confusing
message about a failure they never caused:

```jsx
if (error.name === 'SessionExpiredError') {
  setStatus('');              // ← silent; the redirect explains itself
} else {
  setStatus(error.message);   // ← real errors do deserve a message
}
```

**Why `refresh()` instead of just clearing state?** Because `refresh()` makes the
server the source of the answer. Clearing optimistically is another client-side guess —
the pattern Chapter 4 exists to eliminate. One extra round trip on an error path is a
price worth paying.

---

## The client-side short-circuit, and why it is not security

```js
if (!isSignedIn) {
  throw new SessionExpiredError({ status: 401 });
}
```

This avoids sending a request the server will certainly reject. Fine. But be honest
about what it is: **the server checks the session regardless.** Delete this branch and
nothing becomes less secure — requests still get validated. Its only job is avoiding a
pointless round trip and a confusing error.

The dangerous version of this shortcut is when it *replaces* the server check:

```js
// ❌ "protected" in name only
if (!isLoggedIn) return <div>Please sign in</div>;
// ...and the route below has no server-side guard
```

---

## Testing it

Do these with DevTools open, watching the Network tab:

| # | Action | Expected |
|---|---|---|
| 1 | Signed out, visit `/upload` | Redirected to `/login`; **no** app flash |
| 2 | Sign in from the redirect | Returned to `/upload`, not `/` |
| 3 | Visit `/login` while signed in | Redirected away from the form |
| 4 | Reload while signed in on `/upload` | Stays; no redirect |
| 5 | Signed out, hit the API with `curl` | `401`, **regardless of any UI** |
| 6 | Tamper with the `sid` cookie | Treated as signed out |
| 7 | Log out in tab A, act in tab B | Tab B redirects on its next request |

**Test 5 is the one that matters.** Do it with `curl`, with no browser involved. If it
returns `200`, your route guard is decorative.

**Test 7 is the one that catches missing 401 handling.** Without
`useAuthenticatedFetch`, tab B keeps working with a dead session until something
else happens to fail.

---

## Checkpoint

1. Why is a client-side route guard not a security control? Give the concrete reason.
2. What does `replace` on the `Navigate` component prevent?
3. What breaks if `ProtectedRoute` renders the login form during `LOADING` instead of
   `fallback`?
4. Why must `session.email` come from the database row rather than the request body?
5. Why filter `WHERE owner_email = $1` in SQL rather than checking ownership in
   JavaScript after fetching?
6. Your session is revoked in another tab. What exact chain of code gets React to
   notice?
7. Why does the client-side `!isSignedIn` short-circuit not count as security?

Next: [Chapter 6 — logout, expiry, and the checklist](6-logout-and-expiry.md).