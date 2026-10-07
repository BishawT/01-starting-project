// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Remember which lessons the reader has finished, and where they stopped.
// WHERE:  01-starting-project/src/hooks/useCourseProgress.js
// WHY:    A course that forgets you read lesson 1 every time you come back is
//         not a course, it is a website. Progress lives in localStorage because
//         it is per-browser, per-device state — exactly like a theme choice or
//         a draft you have not submitted yet.
//
// WHERE THE DATA LIVES, AND WHY NOT SOMEWHERE SMARTER
//   localStorage is a string store on the user's own machine. It is the right
//   tool for "which lessons did I tick off", and the wrong tool for anything
//   that must be trusted (their account, their purchases, a grade). Never put a
//   secret in here: any script on the page can read it.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'reactart.js-course.progress.v1';

// Shape of what we persist: which lessons are done, and the last one opened.
const EMPTY_STATE = { completed: [], lastLessonId: null };

/**
 * Read persisted progress, defensively.
 *
 * localStorage can be unavailable (Safari private mode, disabled cookies) and
 * whatever is in there may be from an older version of the course. Every one of
 * those cases means the same thing: start fresh rather than crash.
 *
 * @returns {{ completed: string[], lastLessonId: string | null }}
 */
function readProgress() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;

    const parsed = JSON.parse(raw);

    return {
      completed: Array.isArray(parsed?.completed)
        ? parsed.completed.filter((id) => typeof id === 'string')
        : [],
      lastLessonId: typeof parsed?.lastLessonId === 'string' ? parsed.lastLessonId : null,
    };
  } catch {
    return EMPTY_STATE;
  }
}

/**
 * @returns {{
 *   completed: string[],
 *   lastLessonId: string | null,
 *   markComplete: (lessonId: string) => void,
 *   toggleComplete: (lessonId: string) => void,
 *   rememberLesson: (lessonId: string) => void,
 *   reset: () => void,
 *   isComplete: (lessonId: string) => boolean,
 * }}
 */
export function useCourseProgress() {
  // Lazy initialiser again — read localStorage once, not on every render.
  const [progress, setProgress] = useState(readProgress);

  // The single write path. `updater` receives the current state and returns the
  // next one; returning the same object means "nothing changed" and skips the
  // write entirely. Every mutator below goes through here, so writing to
  // storage cannot be forgotten and only ever happens once per real change.
  const commit = useCallback((updater) => {
    setProgress((current) => {
      const next = updater(current);
      if (next === current) return current;

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Quota exceeded, or storage disabled. The UI still works for this
        // session; it just will not be remembered next time. Nothing to recover.
      }

      return next;
    });
  }, []);

  const markComplete = useCallback(
    (lessonId) => {
      commit((current) =>
        current.completed.includes(lessonId)
          ? current
          : { ...current, completed: [...current.completed, lessonId] }
      );
    },
    [commit]
  );

  const toggleComplete = useCallback(
    (lessonId) => {
      commit((current) => ({
        ...current,
        completed: current.completed.includes(lessonId)
          ? current.completed.filter((id) => id !== lessonId)
          : [...current.completed, lessonId],
      }));
    },
    [commit]
  );

  // Remembered separately from "completed": opening a lesson and finishing it
  // are different events, and the course home page uses the last one to offer
  // "continue where you left off".
  const rememberLesson = useCallback(
    (lessonId) => {
      commit((current) =>
        current.lastLessonId === lessonId
          ? current
          : { ...current, lastLessonId: lessonId }
      );
    },
    [commit]
  );

  const reset = useCallback(() => commit(() => EMPTY_STATE), [commit]);

  const isComplete = useCallback(
    (lessonId) => progress.completed.includes(lessonId),
    [progress]
  );

  return {
    completed: progress.completed,
    lastLessonId: progress.lastLessonId,
    markComplete,
    toggleComplete,
    rememberLesson,
    reset,
    isComplete,
  };
}