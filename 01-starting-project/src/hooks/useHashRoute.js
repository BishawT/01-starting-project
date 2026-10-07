// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Minimal hash-based routing, so lesson pages get real URLs (and survive
//         a refresh) without installing react-router.
// WHERE:  01-starting-project/src/hooks/useHashRoute.js
// WHY:    The course is a set of pages. Hash URLs (#/courses/promises) mean the
//         browser keeps working, the back button works, and a student can send
//         a link to the exact lesson they are stuck on.
//
// WHY NOT react-router
//   The project has exactly three dependencies (react, react-dom, pg). Adding a
//   router for "show a different component based on the URL" is a lot of library
//   for one switch statement. If the app ever grows real nested routes, swap
//   this file out — nothing else in the course touches it.
//
// HOW HASH ROUTING WORKS
//   The part after '#' is never sent to a server. When it changes, the browser
//   fires a 'hashchange' event instead of reloading the page. That single fact is
//   the whole implementation.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';

/**
 * Read the current route out of the URL, normalised.
 *
 * Accepts '#', '#/courses', '#courses/values' — all of them mean the same route
 * — and always returns a leading slash, no trailing slash: '/courses/values'.
 *
 * @returns {string}
 */
function readRoute() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || raw === '/') return '/';

  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

/**
 * Subscribe to the browser's hash.
 *
 * @returns {[string, (next: string) => void]} the current route and a navigate()
 *          function that takes '/courses/values' (with or without the '#').
 */
export function useHashRoute() {
  // Lazy initialiser: read the URL once, on the very first render. Without the
  // () => the browser would be read on every render for no reason.
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    function handleHashChange() {
      setRoute(readRoute());
    }

    window.addEventListener('hashchange', handleHashChange);

    // Cleanup is not optional in React: every subscription you open must be
    // closed, or you leak it for the lifetime of the page. StrictMode will run
    // this effect twice to prove you remembered.
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((next) => {
    const target = `#${next.startsWith('/') ? next : `/${next}`}`;

    // Setting location.hash does NOT fire 'hashchange' when the value is
    // identical to the current one. Clicking the lesson you are already on
    // should still reset the scroll, so handle the no-op case explicitly.
    if (window.location.hash === target) {
      window.scrollTo({ top: 0 });
      return;
    }

    window.location.hash = target;
    // A hash change does not scroll the document, and a lesson page can be
    // taller than the viewport. Always start at the top of the new page.
    window.scrollTo({ top: 0 });
  }, []);

  return [route, navigate];
}