// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 2 — declaring functions, taking arguments, and where a name can
//         see what.
// WHERE:  01-starting-project/src/course/lessons/02-functions-and-scope.js
// WHY:    Almost every JavaScript question reduces to "which function is this
//         running in, and what does it have access to?"
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'functions-and-scope',
  title: 'Functions and scope',
  minutes: 7,
  goal: "Write a function, read one back, and know which variables it can reach.",

  sections: [
    {
      type: 'text',
      body:
        "A function is a named, reusable block of code. That part is easy. The part that matters is **scope**: a function can read the variables that existed where it was *written*, not where it is *called*. Get that backwards and you will spend an afternoon confused.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '30–36',
      note: "A component function. No parameters, but it closes over eight of them.",
      code: `async function handleSubmit(event) {
  event.preventDefault();
  setSubmitted(true);
  setMessage('');

  if (!isFormValid) return;

  const email = enteredEmail.trim().toLowerCase();`,
    },

    {
      type: 'text',
      heading: "Read the parentheses as a contract",
      body:
        "`handleSubmit(event)` promises to be handed one argument, named `event`. Inside the function, `event` is just a local name for whatever was passed. The caller does not have to be React: `handleSubmit({ preventDefault() {} })` is a perfectly legal call, and the function would still work. That is what makes a function testable — you can hand it a fake.",
    },

    {
      type: 'callout',
      tone: 'warn',
      title: "The event object is the reason forms reload the page",
      body:
        "A `<form>` has a built-in behaviour: when it is submitted, the browser navigates to the action URL and throws away the page. `event.preventDefault()` cancels it. Your form has `noValidate` too (`AuthInputs.jsx:128`), which turns off the browser's own validation bubbles so your JavaScript validation is the only one that runs — otherwise a typo would show two error messages at once.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'Database/app.js',
      lines: '84–91',
      note: "A default parameter. Call with no salt and one is generated for you.",
      code: `async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scryptAsync(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}`,
    },

    {
      type: 'list',
      items: [
        "Default values (`salt = ...`) apply only when the argument is `undefined`. Passing `null` explicitly uses the `null`, not the default.",
        "Destructuring parameters reads named values out of an object argument — see `buildSessionCookie(token, { secure = false } = {})` in `session.js:79`.",
        "The whole `= {}` fallback matters: without it, calling with no second argument would throw while destructuring `undefined`.",
        "`return` ends the function immediately. Nothing after it runs, and a function with no `return` gives back `undefined`.",
      ],
    },

    {
      type: 'code',
      lang: 'js',
      file: 'Database/app.js',
      lines: '72–75',
      note: "Early return, used as a guard: reject anything unexpected before doing real work.",
      code: `function getPath(request) {
  return new URL(request.url, 'http://localhost').pathname;
}`,
    },

    {
      type: 'text',
      heading: 'Scope, concretely',
      body:
        "Look at `getPath` above: it knows about nothing except its own argument. Look at `handleSubmit`: it can read `isFormValid`, `enteredEmail`, `setMessage`, `setMode` — all declared above it in the component. Those are in scope because the function was written inside them. Now move `handleSubmit` to another file and every one of those names stops existing, and the code breaks at once. That is scope doing its job.",
    },

    {
      type: 'list',
      ordered: true,
      items: [
        "**One name per binding.** Redeclaring with `let` in the same block is an error; `var` is not and leaks out of blocks — do not start with `var`.",
        "**Inner scope wins.** A function may shadow an outer name, but only inside its own body. Shadowing `email` inside `handleSubmit` has no effect on the `email` prop of any other component.",
        "**Scope is not visibility.** A private-looking `_token` is a naming convention only. Nothing stops another file importing it — that is what the leading underscore is telling the *reader*.",
        "**Hoisting.** `function` declarations and `var` are available above where you wrote them. `let`, `const`, and arrow functions are not — using them earlier throws a \"temporal dead zone\" error.",
      ],
    },

    {
      type: 'text',
      heading: "function and () => are the same thing",
      body:
        "An arrow function is shorter and has no `this` of its own — it inherits it from the surrounding scope. Inside a React component, that difference does not matter, so both styles are used freely in this codebase. Arrow functions become necessary in lesson 5, where a callback needs to keep the surrounding `this` or the surrounding variables.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "Two spellings, one behaviour.",
      code: `// Traditional
function double(value) {
  return value * 2;
}

// Arrow — same result, no return keyword on one-liners
const double = (value) => value * 2;

// Braces are required as soon as you need more than one statement
const describe = (value) => {
  const doubled = value * 2;
  return \`\${value} doubled is \${doubled}\`;
};`,
    },

    {
      type: 'checkpoint',
      items: [
        "`hashPassword(password)` is called with no salt. Where does the salt come from, and what happens if a caller passes `null` instead?",
        "In `handleSubmit`, name three variables that are in scope but are **not** parameters.",
        "Why does `buildSessionCookie` need the `= {}` in `({ secure = false } = {})`?",
        "A function forgets its `return`. What does the caller receive?",
      ],
    },
  ],
};