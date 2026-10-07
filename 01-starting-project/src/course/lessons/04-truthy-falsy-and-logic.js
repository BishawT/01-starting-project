// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 4 — truthy and falsy values, and the three operators that rely
//         on them.
// WHERE:  01-starting-project/src/course/lessons/04-truthy-falsy-and-logic.js
// WHY:    `&&` and `||` are the source of both the tidiest and the most baffling
//         lines in JavaScript. This lesson makes them predictable.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'truthy-falsy-and-logic',
  title: "Truthy, falsy and logic",
  minutes: 6,
  goal: "Use &&, || and ?? without the classic type-coercion surprises.",

  sections: [
    {
      type: 'text',
      body:
        "Most real logic is not `true` or `false` — it is \"some value or nothing\". JavaScript resolves this by treating most values as **truthy** and a small list as **falsy**, then letting `&&` and `||` pass values through rather than collapsing them to booleans.",
    },

    {
      type: 'table',
      head: ['Falsy value', 'What it means'],
      rows: [
        ['`false`', 'The boolean, explicitly'],
        ['`0`', 'Zero is falsy. So is `-0` and `NaN`.'],
        ['`""`', 'Empty string. A string of one space `" "` is **truthy**.'],
        ['`null`', 'Deliberately no value'],
        ['`undefined`', 'No value provided'],
        ['`NaN`', 'The result of `0 / 0`. Always compare with `Number.isNaN`.'],
      ],
    },

    {
      type: 'text',
      body:
        "Everything else — `[]`, `{}`, `\"0\"`, `'false'`, `-1` — is truthy. An empty array is truthy, which surprises people exactly once per career.",
    },

    {
      type: 'text',
      heading: "&& and || return values, not booleans",
      body:
        "This is the part that makes them useful. `a && b` evaluates to `b` if `a` is truthy, otherwise to `a`. That means it can produce a value, not just a yes/no.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '18–19',
      note: "Read this as: only worry about email once they have submitted once.",
      code: `const emailNotValid = submitted && !enteredEmail.includes('@');
const passwordNotValid = submitted && enteredPassword.trim().length < 6;`,
    },

    {
      type: 'text',
      body:
        "Before the first submit, `submitted` is `false`, so `emailNotValid` becomes `false` — and no red text appears while you are still typing. It is a **guard built into the expression**. There is no `if` statement anywhere in that logic.",
    },

    {
      type: 'callout',
      tone: 'warn',
      title: "A classic trap: && with a number",
      body:
        "`message && <p>{message}</p>` is fine, because `message` is a string. But `count && <p>{count}</p>` is a bug: if `count` is `0`, React renders the literal `0` on the page instead of nothing. Convert first: `count > 0 && <p>…</p>`, or use a ternary.",
    },

    {
      type: 'text',
      heading: "|| versus ?? — they are not interchangeable",
      body:
        "Both fall back to a default when the left side is empty. They differ on *which* values count as empty: `||` treats every falsy value as empty, `??` treats only `null` and `undefined`.",
    },

    {
      type: 'code',
      lang: 'js',
      file: 'lesson example',
      note: "Four lines. The first is a bug waiting to happen.",
      code: `const enteredTimeout = 0;

0 || 5000;        // → 5000   ✗ 0 was probably deliberate
0 ?? 5000;        // → 0      ✓ 0 is a real answer

'' || 'default';   // → 'default'
'' ?? 'default';   // → ''      ✓ empty string is a real answer`,
    },

    {
      type: 'text',
      heading: "Optional chaining and nullish coalescing in the real code",
      body:
        "Your auth form has both. `error?.message` reads \"if `error` is null or undefined, the whole expression is undefined — do not crash\". `??` then supplies a fallback only for that case.",
    },

    {
      type: 'code',
      lang: 'jsx',
      file: 'src/components/AuthInputs.jsx',
      lines: '80–84',
      note: "Two lines doing the work of a whole if/else.",
      code: `} catch (error) {
  setMessage(
    error?.message ??
      'Cannot reach the authentication server. Start it with npm run server.'
  );
}`,
    },

    {
      type: 'list',
      items: [
        "`obj?.deeply?.nested` — safe to read at any depth; short-circuits on the first nullish value.",
        "`fn?.()` — call only if `fn` exists.",
        "`a ?? b` — fallback for null/undefined only. Prefer it to `||` for numbers, booleans and strings.",
        "`!value` — turns anything into a boolean. `![]` is `false`, because an empty array is truthy.",
      ],
    },

    {
      type: 'code',
      lang: 'js',
      file: 'src/components/AuthInputs.jsx',
      lines: '122',
      note: "The ternary, because you need a class name or nothing at all — and undefined is how you say \"no class\".",
      code: `<label className={emailNotValid ? 'invalid' : undefined} htmlFor="email">`,
    },

    {
      type: 'checkpoint',
      items: [
        "Evaluate `'hello' && 'world'`, then `0 && 'world'`, then `'' || 'fallback'`.",
        "Why must your password be at least 6 characters for the \"invalid\" state to ever turn on at submit time?",
        "You have `timeout` that may legitimately be `0`. Which of `||` and `??` do you want, and what does the other one do?",
        "What does `error?.message` evaluate to when `error` is `null`?",
      ],
    },
  ],
};