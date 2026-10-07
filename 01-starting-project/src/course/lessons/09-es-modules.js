// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 9 — ES modules: how files find each other, and why module scope
//         runs exactly once.
// WHERE:  01-starting-project/src/course/lessons/09-es-modules.js
// WHY:    This is the mental model behind a lot of otherwise-mysterious
//         behaviour: singletons, circular imports, and what "hoisting" means
//         across files.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'es-modules',
  title: 'ES modules',
  minutes: 6,
  goal: "Import and export correctly, and predict what happens when a module runs.",

  sections: [
    {
      type: 'text',
      body:
        "A **module** is a file with its own top-level scope. You can only touch another file's variables by importing them, and only if it exported them. That is the whole privacy model: no accidental global leakage, because the module's top level is not global.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/main.jsx',
      lines: '1–3',
      note: "Three imports, two of them ours. Note the explicit .jsx extension.",
      code: `import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';`,
    },

    {
      type: 'list',
      items: [
        "`import X from '…'` — **default** export. One per file, and the name is chosen by whoever imports.",
        "`import { a, b } from '…'` — **named** export. Many per file, and the names must match exactly.",
        "`import './index.css'` — side-effect only. It has no bindings; it just needs to run.",
        "`import * as pg from 'pg'` — everything exported, gathered into one object. Your server does this in `app.js`.",
      ],
    },

    {
      type: 'code',
      lang: 'js',
      file: 'Database/app.js',
      lines: '6–16',
      note: "Named imports, a default import, and a module-level constant. All three styles in nine lines.",
      code: `import pg from 'pg';

import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  createSession,
  destroySession,
  readSession,
} from './session.js';

const { Pool } = pg;`,
    },

    {
      type: 'callout',
      tone: 'note',
      title: "Where do the file extensions go?",
      body:
        "Your files **include** extensions (`.js`, `.jsx`) because they run in Node and the browser, which do not guess. The bundler convention — and what you will see in most other React projects — is to omit them for JavaScript files and keep them for CSS and assets. Vite handles both. Be consistent within this project: always include them.",
    },

    {
      type: 'text',
      heading: "A module runs once, no matter how many importers",
      body:
        "The first time anything imports a file, its top-level code runs. Every later import of that file reuses the already-evaluated result. This is why module-level `const`s behave like singletons.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/context/AuthContext.jsx',
      lines: '28–44',
      note: "Runs once at module scope, long before any component renders. Every component gets the SAME object.",
      code: `const AuthContext = createContext({
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
});`,
    },

    {
      type: 'text',
      body:
        "That single shared object is exactly why the default value can be set to something *deliberately wrong*. If a component calls `useAuth()` above the provider, it gets this object and calling `login()` throws loudly — instead of silently receiving `user: null` and rendering the login form forever. That is what makes the comment at the top of the file worth reading.",
    },

    {
      type: 'text',
      heading: "Live bindings and circular imports",
      body:
        "Named imports are **live**: if a module reassigns an exported `let` later, importers see the new value without re-importing. The flip side is that circular imports are fragile — two files importing each other can end up with half-initialised bindings, which is why `AuthContext.jsx` imports from `useSession.js` but never the reverse.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/course/index.js',
      lines: 'see the file',
      note: "Re-exporting: one import site for consumers instead of two.",
      code: `// Defined in one module…
export { SessionStatus };

// …and imported straight back out of the next one, so components
// need a single import for every auth concern:
import { SessionStatus, useAuth } from '../context/AuthContext.jsx';`,
    },

    {
      type: 'checkpoint',
      items: [
        "A file exports both `default` and `SessionStatus`. How do you import each?",
        "Why is `createContext` called at module scope rather than inside the Provider component?",
        "What does `import './index.css'` do differently from `import styles from './index.css'`?",
        "Two files import each other. What goes wrong, and what is the fix?",
      ],
    },
  ],
};