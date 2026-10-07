// Render smoke test: builds the course UI to HTML without a browser, so a typo
// in a component or a bad lesson shape fails loudly here instead of in the page.
//
//   npm run check:render
//
// Run through `vite build --ssr` because the components are JSX, which Node
// cannot parse on its own. Nothing here is imported by the app.

import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

import { COURSE } from '../src/course/index.js';
import CourseHome from '../src/components/course/CourseHome.jsx';
import Courses from '../src/components/course/Courses.jsx';
import LessonSidebar from '../src/components/course/LessonSidebar.jsx';
import LessonView from '../src/components/course/LessonView.jsx';

// Minimal browser globals. renderToString never runs effects, so these only need
// to satisfy the useState initialisers in the hooks.
globalThis.window = {
  location: { hash: '' },
  addEventListener() {},
  removeEventListener() {},
  scrollTo() {},
};
globalThis.localStorage = {
  store: {},
  getItem(key) {
    return this.store[key] ?? null;
  },
  setItem(key, value) {
    this.store[key] = value;
  },
};

const failures = [];

function render(label, element) {
  try {
    const html = renderToString(element);
    console.log(`  ok   ${label} (${html.length} bytes)`);
    return html;
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.log(`  FAIL ${label}: ${error.message}`);
    return '';
  }
}

console.log('Rendering every lesson page:');

const allHtml = COURSE.lessons.map((lesson) =>
  render(
    `lesson "${lesson.id}"`,
    createElement(LessonView, {
      isComplete: false,
      lesson,
      onSelect() {},
      onToggleComplete() {},
    })
  )
);

render(
  'course home (no progress)',
  createElement(CourseHome, { completed: [], lastLessonId: null, onSelect() {} })
);

render(
  'course home (some progress)',
  createElement(CourseHome, {
    completed: COURSE.lessons.slice(0, 3).map((lesson) => lesson.id),
    lastLessonId: COURSE.lessons[3].id,
    onSelect() {},
  })
);

render(
  'sidebar (current lesson highlighted)',
  createElement(LessonSidebar, {
    completed: COURSE.lessons.slice(0, 2).map((lesson) => lesson.id),
    currentLessonId: COURSE.lessons[2].id,
    onSelect() {},
  })
);

// Exercises the two hooks the course shell depends on: hash routing (which
// reads window.location on first render) and progress (which reads
// localStorage). Both initialisers run during SSR, so a mistake in either one
// fails right here.
render('course shell with no route', createElement(Courses));

// Content assertions: a lesson that silently rendered nothing would still pass
// the checks above, so verify the output actually contains the lesson's pieces.
const joined = allHtml.join('\n');

const expectations = [
  ['a lesson title', COURSE.lessons[0].title],
  ['a goal line', 'By the end you can'],
  ['a checkpoint', 'Check yourself'],
  ['a code block', 'code-block__pre'],
  ['a syntax token', 'tok--keyword'],
  ['a file reference', 'AuthInputs.jsx'],
  ['previous/next nav', 'lesson-nav'],
  ['inline code markup', 'inline-code'],
];

console.log('Checking rendered output:');

for (const [label, needle] of expectations) {
  if (joined.includes(needle)) {
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`rendered HTML is missing ${label} ("${needle}")`);
    console.log(`  FAIL missing ${label}`);
  }
}

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const failure of failures) console.error('  ✗', failure);
  process.exit(1);
}

console.log('\nCourse UI renders cleanly.');