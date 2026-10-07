// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Two things — a component that blocks rendering until we know who
//         the user is, and a fetch wrapper that lets the server overrule React.
// WHERE:  01-starting-project/src/components/ProtectedRoute.jsx
//         01-starting-project/src/lib/api.js
// WHY:    Chapter 4 made React agree with the server about who you are.
//         This chapter makes sure that agreement holds even when the server
//         changes its mind mid-session.
//
// THE HEADLINE IDEA
//   Client-side route guards are UX, not security.
//
//   They are genuinely useful — a signed-out user should not see a flash of
//   the app. But they protect nothing, because everything that matters
//   happens on the server. Someone can delete <ProtectedRoute> from the JSX
//   and nothing becomes less secure, because they still cannot read anyone
//   else's data without a valid session.
//
//   So this file has two halves, and they are NOT equally important:
//     <ProtectedRoute>  → convenience. Hide the app from people who cannot use it.
//     requireSession()  → security.   Refuse to do the work without a session.
//   The second lives on the server and is the real one.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { SessionStatus, useAuth } from '../context/AuthContext.jsx';

/**
 * Renders `children` only when signed in.
 *
 * Handles three states, never two. See Ch. 4 § "Three states, not two" for why
 * collapsing LOADING is the root of the "flash of login form" bug.
 *
 * @param {object}   props
 * @param {ReactNode} props.children  the protected content
 * @param {ReactNode} [props.fallback] shown while the session is being checked
 */
export default function ProtectedRoute({ children, fallback = null }) {
  const { status, isSignedIn } = useAuth();

  // Accessing the *reason* the user was sent here lets us return them there
  // after signing in, instead of dumping them on the home page. Without it,
  // "deep link → login → home" loses the user's place.
  const location = useLocation();

  // 1. We genuinely do not know yet. Render nothing (or a spinner) — this is
  //    NOT the same as "signed out", and rendering the login form here is the
  //    flicker that makes apps feel broken.
  if (status === SessionStatus.LOADING) {
    return fallback;
  }

  // 2. Confirmed signed out. Redirect, and record where they were going.
  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 3. Signed in. Render the real thing.
  return children;
}

/*
Wiring it, once you have react-router installed
  (your project does not have it yet — see CH.5 § "If you have no router").

NOTE ON THIS COMMENT: the example below sits inside a block comment, and the
usual JSX comment syntax would contain the two-character sequence that closes a
block comment early — silently turning the rest of this block into real code.
That is why the inner comments are plain prose. It is a real gotcha in any large
commented-out JSX block, and it is the exact bug this file originally had.

    import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
    import { AuthProvider } from './context/AuthContext.jsx';
    import ProtectedRoute from './components/ProtectedRoute.jsx';
    import OnlyWhenSignedOut from './components/OnlyWhenSignedOut.jsx';
    import AuthInputs from './components/AuthInputs.jsx';

    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/login"
            element={<OnlyWhenSignedOut><AuthInputs /></OnlyWhenSignedOut>}
          />

          <Route
            path="/upload"
            element={
              <ProtectedRoute fallback={<p>Loading…</p>}>
                <UploadPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>


The mirror-image component: keep signed-in users OFF the login form.
This prevents the most annoying auth bug there is — you sign out, click back,
and land on a form you already completed.

  function OnlyWhenSignedOut({ children }) {
    const { status, isSignedIn } = useAuth();

    if (status === SessionStatus.LOADING) return null;
    if (isSignedIn) return <Navigate to="/" replace />;
    return children;
  }
*/


// ═══════════════════════════════════════════════════════════════════════════
// The part that actually matters: the server's opinion, enforced in one place
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A fetch wrapper that treats a 401 from ANY endpoint as authoritative.
 *
 * This is the answer to Ch. 4 § "Two sources of truth". Session state can go
 * stale in one direction only — the cookie outlives React state. So instead of
 * polling, we make every authenticated request report back:
 *
 *   server says 401  →  React state is wrong  →  correct it, right now
 *
 * Put this in src/lib/api.js and use it for every call that requires a session.
 * Plain `fetch` is still fine for /api/auth/session and /api/auth/login.
 */

/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>} parsed JSON body; throws on failure
 */
export async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);

  // The server has revoked our session — someone logged us out elsewhere, or
  // it expired. Our cached state is now a lie; drop it.
  //
  // Reaching AuthContext from a plain module is not possible (React only
  // provides context inside components), so this helper is used from a hook
  // that CAN: see useAuthenticatedFetch below.
  if (response.status === 401) {
    throw new SessionExpiredError(response);
  }

  if (!response.ok) {
    // .catch(() => ({})) because a 500 page is often HTML, not JSON, and
    // response.json() would then throw a confusing SyntaxError.
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (HTTP ${response.status}).`);
  }

  // 204 No Content (a successful DELETE/logout, say) has no body to parse.
  if (response.status === 204) return null;

  return response.json();
}

/** Distinct type so callers can tell "your session died" from "the request failed". */
export class SessionExpiredError extends Error {
  constructor(response) {
    super('Session expired.');
    this.name = 'SessionExpiredError';
    this.status = response.status;
  }
}

/**
 * The same wrapper, wired to AuthContext — this is what components use.
 *
 * The dependency on `refresh` is deliberate: when a request comes back 401,
 * we re-ask the server rather than optimistically clearing state. One more
 * round trip, but it means React's answer is always *the server's* answer,
 * never a guess.
 *
 * Returns a stable callback so it is safe in dependency arrays.
 */
export function useAuthenticatedFetch() {
  const { refresh, isSignedIn } = useAuth();

  return useCallback(
    async (url, options = {}) => {
      // Cheap client-side short-circuit: never send a request we know will be
      // rejected. NOT a security control — the server checks anyway. It just
      // avoids a pointless round trip and a confusing error message.
      if (!isSignedIn) {
        throw new SessionExpiredError({ status: 401 });
      }

      try {
        return await apiFetch(url, options);
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          await refresh();   // React now agrees with the server
        }
        throw error;
      }
    },
    [isSignedIn, refresh],
  );
}

/*
Usage:

  function UploadPage() {
    const authFetch = useAuthenticatedFetch();
    const [status, setStatus] = useState('');

    async function handleClick() {
      try {
        const result = await authFetch('/api/upload', { method: 'POST' });
        setStatus('Uploaded.');
      } catch (error) {
        if (error.name === 'SessionExpiredError') {
          // Do NOT set an error message. The user did nothing wrong; they
          // simply need to sign in again, and ProtectedRoute is already
          // redirecting them to /login because refresh() flipped the status.
          setStatus('');
        } else {
          setStatus(error.message);
        }
      }
    }

    return <button type="button" onClick={handleClick}>Upload</button>;
  }
*/


// ═══════════════════════════════════════════════════════════════════════════
// And on the server, the half that actually enforces anything
// ═══════════════════════════════════════════════════════════════════════════

/*
Wraps a handler so it can only run with a valid session. Every authenticated
endpoint needs this, and it must live on the SERVER — a check in React is
advisory at best.

  // Database/app.js
  import { readSession } from './session.js';

  async function requireSession(request, response, db, handler) {
    const session = await readSession(db, request);

    if (!session) {
      // Note: no reason given. "No session" and "expired session" must look
      // identical to an attacker (Ch. 3 § "It returns null, never throws").
      sendJson(response, 401, { message: 'Please sign in.' });
      return null;
    }

    await handler(session);
    return session;
  }

  // Then, in the request handler:

    if (route === 'upload') {
      await requireSession(request, response, db, async (session) => {
        // session.email is now verified server-side for THIS request.
        // Everything below may trust it.
        const result = await db.query(
          'INSERT INTO uploads (owner_email, title) VALUES ($1, $2) RETURNING id',
          [session.email, title],
        );
        sendJson(response, 201, { id: result.rows[0].id });
      });
      return;
    }

The important structural point: `session.email` comes from the DATABASE row
matched by the session token — never from a request body, a query parameter, or
a header the client chose. That is what stops user A from uploading as user B.
*/