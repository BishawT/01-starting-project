// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 3 — arrays and objects: the two shapes you will spend the rest
//         of your life manipulating.
// WHERE:  01-starting-project/src/course/lessons/03-arrays-and-objects.js
// WHY:    Almost all real JavaScript is moving data between arrays and objects.
//         map/filter/reduce and destructuring cover most of it.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'arrays-and-objects',
  title: 'Arrays and objects',
  minutes: 8,
  goal: "Transform a collection, pull values out of an object, and copy instead of mutate.",

  sections: [
    {
      type: 'text',
      body:
        "An **array** is an ordered list. An **object** is a set of key/value pairs. They are the two containers in JavaScript, and you will move between them constantly: arrays arrive from `split`, become objects when keyed by id, and get turned back into arrays for rendering.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "The three array methods that do real work. All return new arrays.",
      code: `const emails = ['ada@example.com', 'grace@example.com', 'alan@example.com', 'nope'];

// filter — keep some
const valid = emails.filter((email) => email.includes('@'));
// ['ada@example.com', 'grace@example.com', 'alan@example.com']

// map — transform each one
const names = valid.map((email) => email.split('@')[0]);
// ['ada', 'grace', 'alan']

// reduce — collapse to one value
const totalLength = emails.reduce((sum, email) => sum + email.length, 0);
// note the 0: the starting value is required here`,
    },

    {
      type: 'callout',
      tone: 'note',
      title: "filter and map return arrays. reduce returns anything.",
      body:
        "The most common reduce mistake is forgetting the initial value. `reduce((a, b) => a + b)` on an empty array throws a TypeError, because with no starting value the first two elements become the accumulator and the item. Passing `0` (or `[]`, or `{}`) makes it work on empty input too.",
    },

    {
      type: 'text',
      heading: "Destructuring — reading named values",
      body:
        "Destructuring pulls several values out of an object (or an array) in one line. It appears constantly in this project: every `useState` call, every `fetch` response, every session read.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '8',
      note: "The most-read line in the whole app. Three names, three state hooks.",
      code: `const { user, status, isSignedIn, login, logout } = useAuth();`,
    },

    {
      type: 'code',
      lang: 'js',
      file: 'Database/app.js',
      lines: '138–139',
      note: "Nested destructuring with a rename. The JSON body arrives as one object.",
      code: `const { email, password } = await readJson(request);`,
    },

    {
      type: 'code',
      lang: 'js',
      file: 'Database/session.js',
      lines: '173–179',
      note: "Destructuring with renaming + defaults, straight off a database row.",
      code: `const row = rows[0];
if (!row) return null;
return {
  email: row.email,
  userId: String(row.user_id),
  expiresAt: row.expires_at,
};`,
    },

    {
      type: 'text',
      heading: 'Copy, do not mutate',
      body:
        "JavaScript objects and arrays are **references**. Passing one to a function hands over a pointer to the same data, so mutating it changes what everyone else sees. When a function should return a *changed copy*, spread it: `{ ...old, key: value }` or `[...old, item]`. This is not stylistic fussiness — it is what keeps React from showing a stale screen.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "Two different arrays. The first still has two items.",
      code: `const original = ['login', 'register'];

const copy = [...original, 'logout'];
// copy    → ['login', 'register', 'logout']
// original → ['login', 'register']   ← untouched

// With an object:
const session = { email: 'ada@example.com', expiresAt: '2026-01-01' };
const updated = { ...session, email: 'grace@example.com' };
// session.email  → 'ada@example.com'    ← original, untouched
// updated.email  → 'grace@example.com'`,
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/course/lessons/03-arrays-and-objects.js',
      lines: 'see below',
      note: "The course itself follows this pattern — lessons are an array, progress is an object.",
      code: `// Adding a lesson: new object, new array, old array untouched
const next = {
  ...current,
  completed: [...current.completed, lessonId],
};`,
    },

    {
      type: 'text',
      heading: "Look things up by key, not by position",
      body:
        "The server route table is an object keyed by `\"METHOD /path\"`. That is a deliberate choice: lookup is a single property access instead of looping through a list and comparing strings.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'Database/app.js',
      lines: '77–82, 114',
      note: "Routes as an object, then one lookup to find the handler name.",
      code: `const ROUTES = {
  'POST /api/auth/register': 'register',
  'POST /api/auth/login': 'login',
  'POST /api/auth/logout': 'logout',
  'GET /api/auth/session': 'session',
};

// ...later, in the request handler:
const route = ROUTES[\`\${request.method} \${getPath(request)}\`];`,
    },

    {
      type: 'checkpoint',
      items: [
        "You have `const rows = [...]` from a database query. Write the one-liner that returns only rows with `expires_at` in the past.",
        "Why does `setMode((currentMode) => ...)` pass a function instead of just `setMode(newMode)`?",
        "`const { a } = obj` and `const { a: renamed } = obj` — what is the difference?",
        "Your `sessions` array holds objects. Write the loop that maps it to an array of emails.",
      ],
    },
  ],
};