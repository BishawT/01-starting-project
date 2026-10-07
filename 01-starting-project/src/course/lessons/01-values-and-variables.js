// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 1 — values, types, and the difference between let and const.
// WHERE:  01-starting-project/src/course/lessons/01-values-and-variables.js
// WHY:    Almost every JavaScript bug is a value being not what you thought it
//         was. This lesson builds the vocabulary for noticing that.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'values-and-variables',
  title: "Values, types and variables",
  minutes: 6,
  goal:
    "Name a value, check its type, and know when to reach for let, const, or neither.",

  sections: [
    {
      type: 'text',
      body:
        "JavaScript has **seven** types you will actually meet in this project: `string`, `number`, `boolean`, `undefined`, `null`, and two kinds of object. Everything else is a detail of one of those.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '11–22',
      note: "Six of the seven types, on screen, in twelve lines.",
      code: `const [enteredEmail, setEnteredEmail] = useState('');
const [enteredPassword, setEnteredPassword] = useState('');
const [mode, setMode] = useState('login');
const [submitted, setSubmitted] = useState(false);
const [message, setMessage] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);

const emailNotValid = submitted && !enteredEmail.includes('@');
const isFormValid = enteredEmail.includes('@') && enteredPassword.trim().length >= 6;`,
    },

    {
      type: 'table',
      head: ['Type', 'Example here', 'What it is'],
      rows: [
        ['`string`', "`'login'`", 'Text. Quotes are not part of the value.'],
        ['`number`', '`6`, `0.5`', 'One number type, not int/float/double.'],
        ['`boolean`', '`false`', 'Only two values: `true` and `false`.'],
        ['`undefined`', 'A function with no `return`', '"Nobody gave me a value."'],
        ['`null`', '`setUser(null)`', '"There is deliberately no value here."'],
        ['`object`', 'The array from `useState`', 'Keyed collection — see lesson 3.'],
        ['`function`', '`handleSubmit`', 'Callable. Also technically an object.'],
      ],
    },

    {
      type: 'text',
      heading: "undefined and null are not the same thing",
      body:
        "This trips up everyone once. `undefined` means *nobody supplied a value* — it is what a variable holds before you assign to it, and what a function returns if you forget `return`. `null` means *somebody deliberately set this to nothing*, usually to empty something out. Your session code uses `null` exactly once, and it is the clearest possible case: `setUser(null)` in `useSession.js` is saying \"I asked the server, and there is nobody signed in\".",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/hooks/useSession.js',
      lines: '68–88',
      note: "Every \"not signed in\" path ends in the same two statements.",
      code: `if (response.status === 401) {
  setUser(null);                        // deliberately empty
  setStatus(SessionStatus.SIGNED_OUT);
  return;
}

// ...or a genuine failure, which also means "nobody" to the UI —
// but the error is kept so it can be reported:
setUser(null);
setStatus(SessionStatus.SIGNED_OUT);
setError(caught);`,
    },

    {
      type: 'text',
      heading: "const does not mean constant",
      body:
        "`const` means *this binding cannot be reassigned*. It says nothing about the value. An array held by a `const` can be pushed to, an object can gain keys. The only thing `const` forbids is writing a new value to the name itself — which is why `const a = 1; a = 2;` throws, while `const list = []; list.push(1);` is perfectly legal.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "Three ways to be const. Only the first one fails.",
      code: `const PI = 3.14159;
PI = 3;              // ✗ TypeError: Assignment to constant variable

const config = {};
config.timeout = 5000;  // ✓ fine — the object gained a key
// config = {};         // ✗ the name cannot point at a new object

const list = [1, 2];
list.push(3);           // ✓ fine — same array, new contents
list[0] = 99;           // ✓ fine`,
    },

    {
      type: 'text',
      heading: "The rule this project follows",
      body:
        "Default to `const`. Switch to `let` only at the moment a value genuinely changes later. And when it does change, ask whether you are mutating the thing or replacing it — if you are replacing it, the array spread from lesson 3 is usually the better tool.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '24–28',
      note: "A let, because the value really does change. Both of them.",
      code: `function switchMode() {
  setMode((currentMode) => (currentMode === 'login' ? 'create' : 'login'));
  setSubmitted(false);
  setMessage('');
}`,
    },

    {
      type: 'callout',
      tone: 'note',
      title: "Asking what type something is",
      body:
        "`typeof value` gives you a string: `\"string\"`, `\"number\"`, `\"boolean\"`, `\"undefined\"`. Two gaps worth knowing: `typeof null` returns `\"object\"` — a bug from 1995 that can never be fixed because too much code depends on it — and arrays also report `\"object\"`. For those, `Array.isArray(value)` and `value === null` are the checks you want.",
    },

    {
      type: 'checkpoint',
      items: [
        "In `const [mode, setMode] = useState('login')`, which part is the value and which part is the setter — and what type is the value?",
        "Your server code does `const normalizedEmail = email.trim().toLowerCase();`. Give the type of `normalizedEmail` before and after the second call.",
        "Why is `setUser(null)` in `useSession.js` a better signal than `setUser('')`?",
        "You need an array you will push onto in a loop. Does it have to be `let`? Why or why not?",
      ],
    },
  ],
};