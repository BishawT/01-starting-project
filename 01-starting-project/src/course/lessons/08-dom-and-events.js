// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 8 — the DOM, event listeners, and how React hides most of it.
// WHERE:  01-starting-project/src/course/lessons/08-dom-and-events.js
// WHY:    React is a layer over the DOM. Knowing what it is doing underneath is
//         what makes debugging it possible instead of guesswork.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'dom-and-events',
  title: 'The DOM and events',
  minutes: 7,
  goal: "Explain what React is doing to the page, and read an event object.",

  sections: [
    {
      type: 'text',
      body:
        "The **DOM** (Document Object Model) is the browser's live tree of HTML elements. `document` is the whole tree; `document.getElementById` finds one node; `.textContent`, `.value` and `.classList` read and change it. React does not replace the DOM — it manipulates it for you, which is why you still meet both worlds.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/main.jsx',
      lines: '9–13',
      note: "The one place the DOM is touched by hand: find the mount node, render into it.",
      code: `ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);`,
    },

    {
      type: 'text',
      body:
        "`getElementById('root')` finds the `<div id=\"root\">` in `index.html`. `createRoot` wraps it in a root React object, and `.render(...)` tells React to own everything inside from now on. That single call is where control passes from vanilla JavaScript to React.",
    },

    {
      type: 'text',
      heading: "Events, and the object they hand you",
      body:
        "A click, a keystroke, or a submit fires an **event**. Your handler receives an event object describing it. Two properties do most of the work: `event.target` (the element the event happened on) and `event.type` (what kind of event it was).",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '139, 151',
      note: "target is the input; .value is its current text. Two reads, two lines of code.",
      code: `onChange={(event) => setEnteredEmail(event.target.value)}
onChange={(event) => setEnteredPassword(event.target.value)}`,
    },

    {
      type: 'callout',
      tone: 'note',
      title: "onChange is not onInput",
      body:
        "React's `onChange` fires on every keystroke — it behaves like the native `input` event, not like the native `change` event (which fires on blur). This is the single most common surprise when moving from vanilla JavaScript to React.",
    },

    {
      type: 'text',
      heading: 'Controlled inputs',
      body:
        "Because you pass both `value` and `onChange`, React owns the value: the input cannot change except by your state changing. Type in the field, `onChange` fires, state updates, React re-renders with the new value. Type nothing and the field stays put — even if something else tried to change the DOM behind React's back, the next render overwrites it.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '136–141',
      note: "The controlled pattern: value comes from state, onChange writes back to state.",
      code: `<input
  id="email"
  type="email"
  value={enteredEmail}
  className={emailNotValid ? 'invalid' : undefined}
  onChange={(event) => setEnteredEmail(event.target.value)}
/>`,
    },

    {
      type: 'text',
      heading: "You still write raw addEventListener",
      body:
        "Some things are not React's job. Your hash router subscribes to the browser's `hashchange` event directly, because the hash is not part of React's state — React does not know or care that the URL changed.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/hooks/useHashRoute.js',
      lines: '38–50',
      note: "Subscribe on mount, unsubscribe on cleanup. Always both, or you leak a listener per render.",
      code: `useEffect(() => {
  function handleHashChange() {
    setRoute(readRoute());
  }

  window.addEventListener('hashchange', handleHashChange);

  return () => window.removeEventListener('hashchange', handleHashChange);
}, []);`,
    },

    {
      type: 'callout',
      tone: 'warn',
      title: "The cleanup function is not optional",
      body:
        "Without that `return`, every re-render adds another listener. A listener that fires twice sets state twice; a hundred renders later it fires a hundred times. If you ever see \"setState on an unmounted component\" or mysteriously duplicated behaviour in a plain `useEffect`, an uncleaned listener is the first thing to check.",
    },

    {
      type: 'checkpoint',
      items: [
        "In `onChange={(event) => setEnteredEmail(event.target.value)}`, what is `event.target`?",
        "What happens if you give an input a `value` but no `onChange`?",
        "What does the function returned from `useEffect` do, and when does it run?",
        "Why does the hash router use `addEventListener` instead of a React event?",
      ],
    },
  ],
};