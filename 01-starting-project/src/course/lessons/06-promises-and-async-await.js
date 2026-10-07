// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 6 — promises and async/await, with an execution-order diagram.
// WHERE:  01-starting-project/src/course/lessons/06-promises-and-async-await.js
// WHY:    The single most common source of confusion in modern JavaScript is
//         "why did my code run out of order?"
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'promises-and-async-await',
  title: "Promises and async / await",
  minutes: 9,
  goal: "Sequence async work, handle failures, and predict what runs when.",

  sections: [
    {
      type: 'text',
      body:
        "JavaScript runs one line at a time on a single thread. Anything that *waits* — a network request, a timer, a file read — cannot block that thread, so it is started and set aside. A **promise** is the object that represents \"the result of something that will be ready later\", with three states: **pending**, **fulfilled**, or **rejected**.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "A promise is just an object you can attach callbacks to.",
      code: `const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

wait(500).then(() => {
  console.log('half a second later');
});
console.log('this printed immediately');   // ← printed FIRST`,
    },

    {
      type: 'text',
      body:
        "Everything before the `await` runs immediately. The `await` is a pause *in that function only* — the browser stays free to run other code. That is why the `console.log` above appears before the timer fires, even though the timer was created first.",
    },

    {
      type: 'text',
      heading: "async / await is the same thing, spelled readably",
      body:
        "Marking a function `async` makes `await` legal inside it and makes its return value a promise. `await` unwraps a promise into the plain value inside — everything else is identical.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: ".then() version and await version, side by side.",
      code: `// Callback style
function load() {
  return fetch('/api/auth/session')
    .then((response) => response.json())
    .then((data) => setUser(data));
}

// async/await style — same behaviour
async function load() {
  const response = await fetch('/api/auth/session');
  const data = await response.json();
  setUser(data);
}`,
    },

    {
      type: 'callout',
      tone: 'warn',
      title: "await is not a wait-for-anything function",
      body:
        "`await` only waits for a promise. `await someNumber` returns the number immediately. If you want a real delay you must await an actual promise, like the `wait()` helper above.",
    },

    {
      type: 'text',
      heading: "try / catch / finally handles both failure paths",
      body:
        "A rejected promise thrown inside an `async` function behaves exactly like a thrown error in a synchronous one — it propagates to the nearest `try`. `finally` runs either way, which is why your form uses it to re-enable the submit button.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '78–87',
      note: "catch shows the error, finally always clears the submitting flag.",
      code: `  } catch (error) {
    setMessage(
      error?.message ??
        'Cannot reach the authentication server. Start it with npm run server.'
    );
  } finally {
    setIsSubmitting(false);
  }`,
    },

    {
      type: 'text',
      heading: "Sequential or parallel — a real decision",
      body:
        "Two `await`s on separate lines run **one after the other**. If the two requests do not depend on each other, start both and await together to halve the time.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "Promise.all runs both at once; sequential runs them in order.",
      code: `// Sequential — total time = a + b
const user  = await fetchUser();
const posts = await fetchPosts();

// Parallel — total time = whichever is slower
const [user, posts] = await Promise.all([
  fetchUser(),
  fetchPosts(),
]);`,
    },

    {
      type: 'callout',
      tone: 'warn',
      title: "Promise.all is all-or-nothing",
      body:
        "If one of those promises rejects, `Promise.all` rejects too and you lose the successful results. When you want partial success, `Promise.allSettled` gives you every outcome with a `status` on each.",
    },

    {
      type: 'text',
      heading: "Your login flow, step by step",
      body:
        "`handleSubmit` awaits `login()`, and `login()` in `AuthContext` awaits `refresh()`. Nesting awaits like this reads top to bottom, and the order is the point: the form does not clear the password until the server has confirmed who the user is.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '75',
      note: "Await the login, THEN touch the form. Reversing these two lines is a classic bug.",
      code: `        await login(email, password);
        setEnteredPassword('');
        setSubmitted(false);`,
    },

    {
      type: 'checkpoint',
      items: [
        "In the `wait(500)` example, which `console.log` runs first and why?",
        "What is the difference between `await 5` and `await wait(5)`?",
        "Your `try` block has a `return` in it. Does `finally` still run?",
        "Rewrite sequential fetches with `Promise.all` for two independent endpoints.",
      ],
    },
  ],
};