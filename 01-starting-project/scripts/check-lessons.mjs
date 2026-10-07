// Smoke test for the lesson content: every section must be renderable, and every
// referenced field must exist. Run: node scripts/check-lessons.mjs
import { COURSE, getLesson, getLessonNeighbours, TOTAL_MINUTES } from '../src/course/index.js';

const KNOWN_TYPES = new Set([
  'text',
  'code',
  'list',
  'table',
  'callout',
  'checkpoint',
  'divider',
]);

const problems = [];
const ids = new Set();

for (const lesson of COURSE.lessons) {
  const where = `lesson "${lesson.id}"`;

  if (ids.has(lesson.id)) problems.push(`${where}: duplicate id`);
  ids.add(lesson.id);

  if (!lesson.title) problems.push(`${where}: missing title`);
  if (!Number.isFinite(lesson.minutes) || lesson.minutes <= 0) {
    problems.push(`${where}: bad minutes`);
  }
  if (!lesson.goal) problems.push(`${where}: missing goal`);
  if (!Array.isArray(lesson.sections) || lesson.sections.length === 0) {
    problems.push(`${where}: missing sections`);
    continue;
  }

  for (const [index, section] of lesson.sections.entries()) {
    const at = `${where} section ${index} (${section.type})`;

    if (!KNOWN_TYPES.has(section.type)) {
      problems.push(`${at}: unknown type`);
      continue;
    }

    if (section.type === 'text') {
      if (!section.body && !section.heading) problems.push(`${at}: no body`);
    }

    if (section.type === 'code') {
      if (!section.code) problems.push(`${at}: no code`);
      if (section.lang && !['js', 'jsx', 'bash', 'sql', 'text'].includes(section.lang)) {
        problems.push(`${at}: unknown lang "${section.lang}"`);
      }
    }

    if (section.type === 'list' && !Array.isArray(section.items)) {
      problems.push(`${at}: items is not an array`);
    }

    if (section.type === 'list') {
      for (const [itemIndex, item] of section.items.entries()) {
        if (typeof item !== 'string') problems.push(`${at}: item ${itemIndex} is not a string`);
      }
    }

    if (section.type === 'table') {
      if (!Array.isArray(section.head)) {
        problems.push(`${at}: head is not an array`);
      } else {
        for (const [cellIndex, cell] of section.head.entries()) {
          if (typeof cell !== 'string') problems.push(`${at}: head cell ${cellIndex} is not a string`);
          if (typeof cell === 'string' && cell.includes("', '")) {
            problems.push(`${at}: head cell ${cellIndex} looks like two cells merged into one`);
          }
        }
      }

      if (!Array.isArray(section.rows)) {
        problems.push(`${at}: rows is not an array`);
      } else {
        for (const [rowIndex, row] of section.rows.entries()) {
          if (!Array.isArray(row)) {
            problems.push(`${at}: row ${rowIndex} is not an array`);
            continue;
          }

          if (section.head && row.length !== section.head.length) {
            problems.push(`${at}: row ${rowIndex} has ${row.length} cells, head has ${section.head.length}`);
          }

          for (const [cellIndex, cell] of row.entries()) {
            if (typeof cell !== 'string') problems.push(`${at}: row ${rowIndex} cell ${cellIndex} is not a string`);
            if (typeof cell === 'string' && cell.includes("', '")) {
              problems.push(`${at}: row ${rowIndex} cell ${cellIndex} looks like several cells merged into one`);
            }
          }
        }
      }
    }

    if (section.type === 'callout') {
      if (section.tone && !['note', 'warn', 'good'].includes(section.tone)) {
        problems.push(`${at}: unknown tone "${section.tone}"`);
      }
      if (!section.body) problems.push(`${at}: no body`);
    }

    if (section.type === 'checkpoint' && !Array.isArray(section.items)) {
      problems.push(`${at}: items is not an array`);
    }
  }

  const { previous, next } = getLessonNeighbours(lesson.id);
  if (!previous && lesson.id !== COURSE.lessons[0].id) {
    problems.push(`${where}: first lesson has no previous`);
  }
}

if (getLesson('does-not-exist') !== null) problems.push('getLesson returned a value for a bad id');

const last = COURSE.lessons.at(-1);
if (getLessonNeighbours(last.id).next !== null) problems.push('last lesson has a next lesson');

console.log(`${COURSE.lessons.length} lessons, ${TOTAL_MINUTES} minutes, ${COURSE.lessons.reduce((n, l) => n + l.sections.length, 0)} sections`);

if (problems.length > 0) {
  console.error('\nProblems:');
  for (const problem of problems) console.error('  ✗', problem);
  process.exit(1);
}

console.log('All lesson content is renderable.');