// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   The one hook that knows how to ask the server "who am I?".
// WHERE:  01-starting-project/src/hooks/useSession.js
// WHY:    A page reload wipes every scrap of React state. Something has to
//         re-establish "the user is signed in" from scratch on every mount,
//         and it has to happen in exactly one place. This is that place.
//
// WHY A HOOK AND NOT JUST useState IN A COMPONENT
//   Because at least four different components need to know who is signed in
//   (the header, the auth form, the upload button, the route guard). If each
//   one ran its own useEffect + fetch, you would get N identical requests on
//   every page load and N chances to get the logic subtly different.
//
// THE ONE MISTAKE THIS FILE IS BUILT TO AVOID
//   Copying session state into local component state, and then forgetting to
//   re-sync when something else changes it. See CH.4 § "Two sources of truth".
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';

const SESSION_ENDPOINT = '/api/auth/session';

/**
 * The three states a session can be in.
 *
 * Notice 'loading'. Collapsing it into a boolean `isLoggedIn` means your UI
 * cannot tell "still asking" from "definitely not signed in", so it either
 * flashes the login form at every real user, or renders the app for everyone
 * and yanks it away a moment later. Three states, always.
 */
export const SessionStatus = {
  LOADING: 'loading',   // request in flight; we do not know yet
  SIGNED_IN: 'signedIn',
  SIGNED_OUT: 'signedOut',
};

/**
 * @returns {{
 *   user: { email: string, expiresAt: string } | null,
 *   status: 'loading' | 'signedIn' | 'signedOut',
 *   error: Error | null,
 *   refresh: () => Promise<void>,
 * }}
 */
export function useSession() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(SessionStatus.LOADING);
  const [error, setError] = useState(null);

  // The one request. Split out so both the mount effect and refresh() can
  // share it, and so we can attach a fresh AbortSignal each time.
  const fetchSession = useCallback(async (signal) => {
    setError(null);

    try {
      const response = await fetch(SESSION_ENDPOINT, {
        method: 'GET',
        // No credentials option needed! The browser attaches the HttpOnly
        // session cookie automatically, because vite.config.js proxies /api
        // to :3001 and so the request is SAME-ORIGIN from the browser's point
        // of view. See CH.2 § "Cookies attach themselves".
        signal,
      });

      // 401 is the EXPECTED answer for a signed-out visitor. It is not an
      // error, and treating it as one would show a red banner to every
      // logged-out visitor. Branch on it before the !response.ok check.
      if (response.status === 401) {
        setUser(null);
        setStatus(SessionStatus.SIGNED_OUT);
        return;
      }

      // Anything else non-OK is a genuine problem (server down, 500, bad
      // proxy config). Surface it instead of silently pretending signed out,
      // otherwise you will debug "user keeps getting logged out" for an hour.
      if (!response.ok) {
        throw new Error(`Could not load session (HTTP ${response.status}).`);
      }

      const data = await response.json();

      // TRUST THE SERVER, NOT LOCAL STATE.
      // This is the line that Ch.1's Job 2 depends on. The email rendered
      // after login must come from the server's answer, not from a form field.
      setUser({ email: data.email, expiresAt: data.expiresAt });
      setStatus(SessionStatus.SIGNED_IN);
    } catch (caught) {
      // An aborted request is normal control flow, not a failure. React aborts
      // the in-flight request every time the effect re-runs, so without this
      // check you get noise on every navigation.
      if (caught.name === 'AbortError') return;

      setUser(null);
      setStatus(SessionStatus.SIGNED_OUT);
      setError(caught);
    }
  }, []);

  // ── Run once, on mount ──────────────────────────────────────────────────
  useEffect(() => {
    // AbortController is the browser's cancel button for fetch. Without one,
    // if this component unmounts mid-request the response arrives later and
    // tries to set state on a dead component — React warns, and in React 18+
    // it can leak.
    const controller = new AbortController();

    fetchSession(controller.signal);

    // Return value of useEffect = the cleanup function. React calls it before
    // the next run and on unmount. Note the implicit return of the arrow.
    return () => controller.abort();
  }, [fetchSession]);

  const refresh = useCallback(async () => {
    // A second, throwaway controller: refresh() is not tied to the effect
    // lifecycle, so aborting it from cleanup() would cancel it wrongly.
    await fetchSession(new AbortController().signal);
  }, [fetchSession]);

  return { user, status, error, refresh };
}