// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   The JavaScript course index: metadata plus every lesson, in order.
// WHERE:  01-starting-project/src/course/index.js
// WHY:    One import site for the course. The UI never imports a lesson file
//         directly — it asks for the ordered list, or for one lesson by id.
//         Adding lesson 10 means adding one import and one array entry.
//
// A NOTE ON HOW THE CONTENT IS STORED
//   Each lesson is a plain JavaScript module that exports data — an array of
//   section objects — not JSX. Two reasons:
//     1. The content is readable in the browser and in the repo without any
//        build step or markdown parser.
//     2. Data (not markup) means the renderer can enforce the rules: every
//        section type is rendered by one known component, and nothing in a
//        lesson can inject raw HTML into the page.
//
//   The trade-off is that lesson text lives in a .js file instead of a .md file.
//   In exchange, no markdown dependency, and code examples arrive already
//   highlighted and copyable.
// ────────────────────────────────────────────────────────────────────────────

import introduction from './lessons/00-introduction.js';
import domAndEvents from './lessons/08-dom-and-events.js';
import esModules from './lessons/09-es-modules.js';
import promisesAndAsync from './lessons/06-promises-and-async-await.js';
import closuresAndCallbacks from './lessons/05-closures-and-callbacks.js';
import fetchAndTheServer from './lessons/07-fetch-and-the-server.js';
import truthyFalsyAndLogic from './lessons/04-truthy-falsy-and-logic.js';
import valuesAndVariables from './lessons/01-values-and-variables.js';
import functionsAndScope from './lessons/02-functions-and-scope.js';
import arraysAndObjects from './lessons/03-arrays-and-objects.js';

export const COURSE = {
  id: 'javascript-foundations',
  title: 'JavaScript Foundations',
  tagline: 'One introduction plus nine short lessons, written against this app',
  description:
    'Start with what JavaScript actually is, then read one short lesson at a time — every example is a line that already exists in this project. Read one, close the tab, come back tomorrow — your place is saved.',
  level: 'Beginner',
  lessons: [
    introduction,
    valuesAndVariables,
    functionsAndScope,
    arraysAndObjects,
    truthyFalsyAndLogic,
    closuresAndCallbacks,
    promisesAndAsync,
    fetchAndTheServer,
    domAndEvents,
    esModules,
  ],
};

/** Total reading time for the whole course, in minutes. */
export const TOTAL_MINUTES = COURSE.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);

/**
 * Look up one lesson by its id.
 *
 * @param {string | null | undefined} lessonId
 * @returns {object | null}
 */
export function getLesson(lessonId) {
  return COURSE.lessons.find((lesson) => lesson.id === lessonId) ?? null;
}

/**
 * Position of a lesson in the course.
 *
 * @param {string | null | undefined} lessonId
 * @returns {number} -1 when the lesson does not exist.
 */
export function getLessonIndex(lessonId) {
  return COURSE.lessons.findIndex((lesson) => lesson.id === lessonId);
}

/**
 * The lessons either side of this one, for the Previous / Next buttons.
 *
 * Both are nullable on purpose: the first lesson has no previous and the last
 * has no next, and the view needs to know which end it is at.
 *
 * @param {string} lessonId
 * @returns {{ previous: object | null, next: object | null }}
 */
export function getLessonNeighbours(lessonId) {
  const index = getLessonIndex(lessonId);

  if (index === -1) return { previous: null, next: null };

  return {
    previous: index > 0 ? COURSE.lessons[index - 1] : null,
    next: index < COURSE.lessons.length - 1 ? COURSE.lessons[index + 1] : null,
  };
}