// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lift "who is signed in" to React Context so every component can
//         read it, and so there is exactly ONE copy of that state.
// WHERE:  01-starting-project/src/context/AuthContext.jsx
//         Wrap <App /> in src/main.jsx (shown at the bottom of this file).
// WHY:    Session knowledge is needed all over the tree — the header shows
//         "Sign Out", the form decides whether to render, the upload button
//         should be disabled. Threading it down through props is what makes
//         people give up on props.
//
// THE ACTUAL PROBLEM CONTEXT SOLVES HERE
//   Without Context you would be tempted to store the user in a module-level
//   variable (let currentUser = null) so everyone could "reach" it. That is
//   global mutable state: no re-render is triggered when it changes, so the
//   UI silently goes stale, and it breaks completely with server rendering.
//   Context is the supported way to share one value across a whole tree.
// ────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { SessionStatus, useSession } from '../hooks/useSession.js';

// Re-exported so components have ONE import site for auth concerns. Without
// this, a consumer needs two imports to get a user and a status, and if they
// ever drift apart it is not obvious why.
export { SessionStatus };

// ─── The context object ─────────────────────────────────────────────────────
// The default value matters even though you will always use the Provider:
// createContext runs at MODULE level, so this object exists before any
// component renders. useContext() below falls back to it if someone forgets
// the provider. Making the default obviously-wrong ("you forgot the provider")
// turns a silent bug into a loud one.
const AuthContext = createContext({
  user: null,
  status: SessionStatus.LOADING,
  error: null,
  isLoading: true,
  isSignedIn: false,
  login: async () => {
    throw new Error('useAuth() used outside <AuthProvider>.');
  },
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }) {
  // All three pieces of session truth come from ONE hook call, here at the
  // top of the tree. This is the whole point: one request, one copy.
  const { user, status, error, refresh } = useSession();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── POST /api/auth/login ────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Re-throw so the CALLER can decide how to show it. The form already
        // has a setMessage() slot (AuthInputs.jsx:42); duplicating that here
        // would mean two places rendering the same error.
        throw new Error(data.message || 'Unable to sign in.');
      }

      // THE CRITICAL STEP.
      //
      // The server just wrote an HttpOnly cookie. We cannot read it (that is
      // the point) — but the browser now holds it, so our old cached answer
      // ("signed out") is stale. refresh() asks the server what it thinks.
      //
      // Compare with the current code, which does this instead:
      //     setIsLoggedIn(true);                     // AuthInputs.jsx:52
      // That trusts the client. This trusts the server.
      //
      // If you ever skip this, the UI will not update until the next full page
      // load — a very confusing "logged in but still seeing the form" bug.
      await refresh();

      return data;
    } finally {
      setIsSubmitting(false);
    }
  }, [refresh]);

  // ── POST /api/auth/logout ───────────────────────────────────────────────
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
      // re-fetching would truthfully report SIGNED_IN — putting the UI into a
      // state the user cannot escape.
    }

    // Only reached if the server did not throw, so the row is really gone.
    await refresh();
  }, [refresh]);

  // ── Derived, convenient flags ───────────────────────────────────────────
  // Everything downstream can read status, but most components only care
  // about two booleans. Deriving them here means one place to get it right.
  const isLoading = status === SessionStatus.LOADING;
  const isSignedIn = status === SessionStatus.SIGNED_IN;

  // ── The value we share ──────────────────────────────────────────────────
  // useMemo keeps the object identity STABLE across renders.
  //
  // Why that matters: every consumer re-renders whenever the context value's
  // identity changes. A fresh object literal every render would re-render the
  // entire app on every single render of AuthProvider — which defeats the
  // purpose entirely.
  //
  // The dependency list must list every value referenced inside. Forgetting
  // one is the classic useMemo bug: the value silently stays stale after that
  // dependency changes.
  const value = useMemo(
    () => ({
      user,
      status,
      error,
      isLoading,
      isSignedIn,
      isSubmitting,
      login,
      logout,
      refresh,
    }),
    [user, status, error, isLoading, isSignedIn, isSubmitting, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Read the session from any component.
 *
 * The `use` prefix plus a throw is a convention, not a rule — but it is a
 * good one, because it means a component used in the wrong place fails loudly
 * and immediately, instead of silently seeing `user: null` and rendering the
 * login form forever.
 */
export function useAuth() {
  return useContext(AuthContext);
}

// ═══════════════════════════════════════════════════════════════════════════
// Wire it up in src/main.jsx — note: no StrictMode, matching your current file
// ═══════════════════════════════════════════════════════════════════════════

/*
import ReactDOM from 'react-dom/client';
import { StrictMode } from 'react';        // ← read the note below before adding

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
*/

// ─── A note on StrictMode ───────────────────────────────────────────────────
// Your main.jsx does NOT use <StrictMode> today, so useEffect runs once and
// you will not notice double-invocation.
//
// If you add <StrictMode> (you should, eventually), React 18+ deliberately runs
// effects TWICE in development to expose exactly the bugs above — missing
// AbortController cleanup, missing key props, side effects during render. It is
// a feature.
//
// Two consequences for THIS code:
//   1. You will see two /api/auth/session requests. Harmless; the first is
//      aborted by the cleanup function, and AbortError is swallowed.
//   2. Nothing in a component body may have side effects. All I/O goes in
//      useEffect.
//
// Do NOT "fix" the duplicate request by adding a hasFetched ref guard — that
// hides the real bug StrictMode is trying to show you.


// ═══════════════════════════════════════════════════════════════════════════
// Consuming it — two real examples
// ═══════════════════════════════════════════════════════════════════════════

/*
// A header that knows the user. Note it handles all THREE states, not two.
function Header() {
  const { user, isLoading, isSignedIn, logout } = useAuth();

  if (isLoading) return <p>Checking your session…</p>;
  if (!isSignedIn) return <a href="/login">Sign In</a>;

  return (
    <header>
      <p>Signed in as {user.email}</p>
      <button type="button" onClick={logout}>Sign Out</button>
    </header>
  );
}


// A button that must only work when signed in.
function UploadButton({ onUpload }) {
  const { isSignedIn, login } = useAuth();

  if (!isSignedIn) {
    return <button type="button" onClick={() => login()}>Sign in to upload</button>;
  }

  return <button type="button" onClick={onUpload}>Upload</button>;
}
*/