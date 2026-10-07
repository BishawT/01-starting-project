// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 7 — fetch, HTTP status codes, JSON, and why your URL is
//         relative.
// WHERE:  01-starting-project/src/course/lessons/07-fetch-and-the-server.js
// WHY:    The browser and the server are two different programs on two different
//         machines. fetch is the only conversation they have.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'fetch-and-the-server',
  title: 'fetch and the server',
  minutes: 9,
  goal: "Send and read HTTP requests, and check status before trusting a body.",

  sections: [
    {
      type: 'text',
      body:
        "Your frontend runs in the browser. Your backend (`Database/app.js`) runs in Node. `fetch` is how they talk: you describe a request, and you get back a **response** whose `.json()` you read. That is the whole model — the server has no memory of you between calls unless you make it remember (that is what the session cookie is for).",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '48–56',
      note: "The canonical POST. Body, method, and a JSON content-type header.",
      code: `response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});`,
    },

    {
      type: 'text',
      body:
        "Three details are mandatory. `method` says what you are doing. `headers` tells the server the body is JSON rather than a form. `body` is the payload, and `JSON.stringify` is not optional — the browser will refuse to send a plain object as a body.",
    },

    {
      type: 'table',
      head: ['Status', 'Name', 'Meaning here'],
      rows: [
        ['`200`', 'OK', 'Login succeeded. Body has the email.'],
        ['`201`', 'Created', 'Account registered. Body has a message.'],
        ['`400`', 'Bad Request', 'Validation failed — show `message` to the user.'],
        ['`401`', 'Unauthorized', 'Wrong password, or no session. Expected, not a crash.'],
        ['`404`', 'Not Found', 'No such route. Check the URL.'],
        ['`409`', 'Conflict', 'Email already registered — your duplicate check.'],
        ['`500`', 'Server Error', 'The server broke. Never show a stack trace to a user.'],
      ],
    },

    {
      type: 'callout',
      tone: 'warn',
      title: "fetch does not reject on HTTP errors",
      body:
        "A 404 or 500 is a *successful* round trip from `fetch`'s point of view — it only rejects if the network itself failed. This is why `response.ok` exists and why you must check it. A `try/catch` alone will not catch a wrong password.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/hooks/useSession.js',
      lines: '67–82',
      note: "401 is handled BEFORE the ok check, because 401 is the normal signed-out answer.",
      code: `if (response.status === 401) {
  setUser(null);
  setStatus(SessionStatus.SIGNED_OUT);
  return;
}

if (!response.ok) {
  throw new Error(\`Could not load session (HTTP \${response.status}).\`);
}

const data = await response.json();`,
    },

    {
      type: 'text',
      body:
        "The `.json()` call is also worth understanding: a response body is raw bytes. `.json()` parses it and returns a promise. Always `await` it, and always `await` it *after* the status check — parsing the body of a 500 gives you an error message object, not the data you wanted.",
    },

    {
      type: 'text',
      heading: "Why the URL has no port",
      body:
        "Your fetch uses `/api/auth/session`, not `http://localhost:3001/api/...`. `vite.config.js` proxies `/api` to port 3001 during development. From the browser's perspective every call is same-origin with the page — which is also why the session cookie is attached automatically, with no `credentials` option.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'vite.config.js',
      lines: '8–13',
      note: "The proxy. In production, a reverse proxy does this same job.",
      code: `server: {
  open: true,
  port: 3000,
  proxy: {
    '/api': 'http://localhost:3001',
  },
}`,
    },

    {
      type: 'text',
      heading: "Cancelling a request you no longer want",
      body:
        "`AbortController` is the browser's cancel button. Your session hook creates one, passes its signal to `fetch`, and aborts it on cleanup — so when the component unmounts mid-request, the response is discarded instead of trying to update a dead component.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/hooks/useSession.js',
      lines: '105–113',
      note: "Create, pass, and abort on cleanup. Three lines, one complete lifecycle.",
      code: `const controller = new AbortController();

fetchSession(controller.signal);

// cleanup — runs on unmount and before the next run
return () => controller.abort();`,
    },

    {
      type: 'callout',
      tone: 'note',
      title: "AbortError is not a failure",
      body:
        "Aborting rejects the promise with an error named `AbortError`. Your code checks `if (caught.name === 'AbortError') return;` and ignores it, because a cancelled request is normal control flow rather than something to show the user.",
    },

    {
      type: 'checkpoint',
      items: [
        "What does `fetch` do when the server returns 500 — reject, or resolve with `ok: false`?",
        "Why check `response.status === 401` before `!response.ok`?",
        "What breaks if you forget `headers: { 'Content-Type': 'application/json' }` on a POST?",
        "What does the abort cleanup function prevent from happening?",
      ],
    },
  ],
};