// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Lesson 0 — the introduction: what JavaScript is, where it came from,
//         where it runs, and how this course is laid out.
// WHERE:  01-starting-project/src/course/lessons/00-introduction.js
// WHY:    The other lessons assume you know what the language is and why it
//         exists. This one carries that context so a total beginner can start
//         at lesson 1 without gaps.
// ────────────────────────────────────────────────────────────────────────────

export default {
  id: 'introduction',
  title: 'Introduction: what is JavaScript?',
  minutes: 4,
  goal:
    "Say what JavaScript is, who wrote it and when, list the places it runs, and explain how this course is structured.",

  sections: [
    {
      type: 'text',
      body:
        "**JavaScript** is the programming language of the web browser. HTML gives a page its structure, CSS gives it its look, and JavaScript gives it *behaviour* — what happens when you click, type, scroll, or ask the server for something. Every interactive part of this app, from the login form to the lesson sidebar, is JavaScript.",
    },

    {
      type: 'text',
      heading: "The three layers of a web page",
      body:
        "These three never overlap. Each layer does one job, and a page works even if only the first two are present — JavaScript is what you add when the page needs to *do* something.",
    },

    {
      type: 'table',
      head: ['Layer', 'Language', 'Job', 'Example in this project'],
      rows: [
        ['Structure', '`HTML` (JSX)', 'What is on the page', 'The `<header>` and `<h1>` you saw'],
        ['Presentation', '`CSS`', 'How it looks', 'The gradient in `index.css`'],
        ['Behaviour', '`JavaScript`', 'What it does', 'Clicking a lesson in the sidebar'],
      ],
    },

    {
      type: 'text',
      heading: "Where JavaScript came from",
      body:
        "JavaScript was invented in **1995** by **Brendan Eich** at Netscape Communications, the company behind the early browser Netscape Navigator. It was written in about ten days in May 1995 — first under the name *Mocha*, then *LiveScript*, and finally **JavaScript** as a marketing move alongside Sun Microsystems, the makers of Java. The two languages have **nothing** to do with each other beyond the shared word \"Java\".",
    },

    {
      type: 'callout',
      tone: 'note',
      title: "JavaScript is not Java",
      body:
        "The name is history and marketing, not a relationship. JavaScript is a small, flexible language that runs inside a browser; Java is a large, compiled language that does not. Knowing one tells you almost nothing about the other.",
    },

    {
      type: 'text',
      heading: "How it became a standard",
      body:
        "Because every browser vendor wanted to add their own features, JavaScript nearly fractured into incompatible dialects. Netscape handed the language to **ECMA International** in 1996, which published it as **ECMAScript** (standard ECMA-262) in 1997. Every version since has been numbered: ES5 (2009) and the big **ES6 / ECMAScript 2015** release — `let`/`const`, arrow functions, classes, promises, and modules — are the ones that shaped the code you read in the rest of this course.",
    },

    {
      type: 'table',
      head: ['Year', 'What happened'],
      rows: [
        ['1995', 'Brendan Eich writes JavaScript at Netscape in about 10 days'],
        ['1996', 'Netscape hands the language to ECMA International for standardising'],
        ['1997', 'ECMAScript 1 is published — one language, every browser'],
        ['2009', 'ES5: strict mode, `JSON`, the version the whole web settled on'],
        ['2015', 'ES6: `let`/`const`, arrow functions, classes, promises, modules'],
        ['2016+', 'One new edition every year — the language you use today'],
      ],
    },

    {
      type: 'text',
      heading: "Where JavaScript runs",
      body:
        "JavaScript started in the browser, but it escaped. Today the same language runs in three completely different places, and this project uses all three of them.",
    },

    {
      type: 'list',
      items: [
        "**In the browser** — every site you visit. Each browser ships its own engine: V8 in Chrome, SpiderMonkey in Firefox, JavaScriptCore in Safari.",
        "**On the server** — through **Node.js**, which runs V8 outside the browser. The login API in this project (`Database/app.js`) is plain Node.js JavaScript.",
        "**Everywhere else** — mobile apps (React Native), desktop apps (Electron), command-line tools, and build tools like Vite that compile this very project.",
      ],
    },

    {
      type: 'code',
      lang: 'js',
      file: 'the same code, three places',
      note: "One language: in a page, in a script tag, or on a server with node.",
      code: `// In the browser — react to a click:
button.addEventListener('click', () => {
  console.log('you clicked me');
});

// On the server — read a row from a database (this project's API):
const { rows } = await pool.query('SELECT id, email FROM users');

// In a terminal — the file runs with no browser at all:
node -e "console.log('hello from Node')"`,
    },

    {
      type: 'text',
      heading: "Why this course teaches it this way",
      body:
        "Every lesson is short — a few minutes, one idea — and every example is a real line from **this app**, not a made-up snippet. Read a lesson, open the file it points at, then come back tomorrow: your place, your finished lessons, and your progress are all saved in your browser automatically.",
    },

    {
      type: 'list',
      ordered: true,
      items: [
        "Each lesson opens with a **goal** — what you will be able to do by the end.",
        "Code blocks name the **real file and lines** they came from, so you can find them.",
        "A **checkpoint** at the end tests you before you move on.",
        "Use **Mark as finished** in the header — the sidebar counts them for you.",
      ],
    },

    {
      type: 'callout',
      tone: 'good',
      title: "The order of the course",
      body:
        "Start with **values and variables** (what data *is*), then functions, arrays and objects, logic, closures, promises, the server, the DOM, and modules. Each lesson leans on the one before it — so if a term is unfamiliar, the lesson that explains it is usually earlier in the list.",
    },

    {
      type: 'checkpoint',
      items: [
        "In your own words: what is the difference between HTML, CSS and JavaScript on a page?",
        "Who invented JavaScript, in what year, and at which company?",
        "Name two places JavaScript runs today besides the browser.",
        "Why is JavaScript unrelated to Java despite the name?",
        "What does ES6 stand for, and roughly when was it released?",
      ],
    },
  ],
};
