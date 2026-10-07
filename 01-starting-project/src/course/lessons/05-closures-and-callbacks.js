// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 5 — closures and callbacks: functions that remember where they
//         came from.
// WHERE:  01-starting-project/src/course/lessons/05-closures-and-callbacks.js
// WHY:    Closures explain why React needs useCallback and useMemo, and why a
//         loop with var produced the wrong answer for twenty years.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'closures-and-callbacks',
  title: "Closures and callbacks",
  minutes: 8,
  goal: "Explain what a closure captures, and use callbacks without surprising yourself.",

  sections: [
    {
      type: 'text',
      body:
        "A **closure** is a function that remembers the variables that existed where it was created, even after the outer function has finished running. You already use one every time you pass a function to `map`, `filter` or an event handler.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "makeCounter returns a function that still remembers count.",
      code: `function makeCounter() {
  let count = 0;             // lives in makeCounter's scope

  return function increment() {
    count = count + 1;       // still here, even though makeCounter has returned
    return count;
  };
}

const next = makeCounter();
next();   // 1
next();   // 2  ← count survived

const other = makeCounter();
other();  // 1  ← a separate closure, its own count`,
    },

    {
      type: 'text',
      body:
        "Each call to `makeCounter()` creates a **new** `count`. That is why `other` starts at 1. Closures capture per-invocation state, not one shared copy.",
    },

    {
      type: 'text',
      heading: "Callbacks are closures",
      body:
        "A callback is simply a function you hand to some other code to call later. Because it runs later, it must bring its own context with it — that is what makes it a closure. Every arrow function you pass to `map` in this course is one.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'Database/session.js',
      lines: '137–141',
      note: "A default parameter that calls randomBytes. Only evaluated if salt is missing.",
      code: `export async function createSession(db, userId) {
  const token = randomBytes(32).toString('hex');`,
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '139',
      note: "The most common callback you will write. event is React's synthetic event object.",
      code: `onChange={(event) => setEnteredEmail(event.target.value)}`,
    },

    {
      type: 'text',
      heading: "The gotcha that trips everyone",
      body:
        "A callback inside a loop closes over the loop variable. With `var`, all callbacks see the *same* variable, so they all report the final value. `let` gives each iteration its own binding, which is why every `for…of` and every `for` with `let` in modern code is correct by default.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "Two lines of difference, two completely different outputs.",
      code: `// ✗ var — one shared binding
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 3, 3, 3

// ✓ let — one binding per iteration
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 0, 1, 2`,
    },

    {
      type: 'text',
      heading: 'Now the React payoff',
      body:
        "Your `AuthContext.jsx` wraps `login`, `logout` and `refresh` in `useCallback`, and the whole shared object in `useMemo`. Both are about closure identity: React compares function references to decide whether to re-render. A fresh closure on every render means every consumer re-renders every time, so the identities are pinned with a dependency list.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/context/AuthContext.jsx',
      lines: '142–149',
      note: "The dependency array lists everything referenced inside. Miss one and the value goes stale.",
      code: `const value = useMemo(
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
);`,
    },

    {
      type: 'callout',
      tone: 'note',
      title: "Stale closures, in one sentence",
      body:
        "A closure captures values at the moment it was created. If the value changes afterwards, the old closure still sees the old one. That is why a `setTimeout` or `setInterval` callback reading `count` in a `useEffect` can log stale values — and why the effect needs the value in its dependency list.",
    },

    {
      type: 'checkpoint',
      items: [
        "Explain in one sentence why `other()` returns 1 after `next()` returned 2.",
        "Rewrite the `var` loop above using `forEach` and an arrow function. Does it work? Why?",
        "You add a `retryCount` to the `useMemo` dependency list but forget to include it. What breaks?",
        "What does the callback in `onChange={(event) => ...}` close over, and what is passed in?",
      ],
    },
  ],
};