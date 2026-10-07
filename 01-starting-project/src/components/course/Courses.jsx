// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   The gate. Only renders the course once the server says somebody is
//         signed in, and decides which lesson page to show.
// WHERE:  01-starting-project/src/components/course/Courses.jsx
// WHY:    The whole point of the course is that it sits behind the session the
//         auth tutorial builds, so "logged in" is proven by the server rather
//         than claimed by a boolean in React state.
//
// ONE HONEST CAVEAT
//   This is UI gating. The lesson text is bundled into the JavaScript that the
//   browser downloads, so a determined reader could open DevTools and read it
//   without signing in. Making that impossible means serving lessons from
//   /api behind the session check — a real change to Database/app.js, and a
//   sensible next step, but not this one's job. Say so rather than implying
//   the content is secret.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect } from 'react';

import { COURSE, getLesson } from '../../course/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCourseProgress } from '../../hooks/useCourseProgress.js';
import { useHashRoute } from '../../hooks/useHashRoute.js';
import CourseHome from './CourseHome.jsx';
import LessonSidebar from './LessonSidebar.jsx';
import LessonView from './LessonView.jsx';

const COURSE_ROOT = '/courses';

export default function Courses() {
  const { user, logout } = useAuth();
  const [route, navigate] = useHashRoute();
  const { completed, lastLessonId, rememberLesson, reset, toggleComplete, isComplete } =
    useCourseProgress();

  // '#/courses/values-and-variables' → 'values-and-variables'
  // Anything that is not /courses/<known-id> falls back to the course home.
  const lessonId = route.slice(`${COURSE_ROOT}/`.length);
  const lesson = getLesson(lessonId);

  // Remember where the reader is, but only once we know the lesson exists —
  // otherwise a typo'd URL would overwrite their saved position.
  useEffect(() => {
    if (lesson) {
      rememberLesson(lesson.id);
    }
  }, [lesson, rememberLesson]);

  const handleSelect = useCallback(
    (nextLessonId) => {
      navigate(nextLessonId ? `${COURSE_ROOT}/${nextLessonId}` : COURSE_ROOT);
    },
    [navigate]
  );

  const handleToggleComplete = useCallback(
    (id) => {
      toggleComplete(id);
    },
    [toggleComplete]
  );

  return (
    <div className="course">
      <div className="course-bar">
        <button className="course-bar__home" onClick={() => handleSelect(null)} type="button">
          <span className="course-bar__title">{COURSE.title}</span>
          <span className="course-bar__tagline">{COURSE.tagline}</span>
        </button>

        <div className="course-bar__account">
          {user ? <span className="course-bar__user">{user.email}</span> : null}
          <button className="text-button" onClick={() => logout()} type="button">
            Sign Out
          </button>
        </div>
      </div>

      <div className="course-layout">
        <LessonSidebar
          completed={completed}
          currentLessonId={lesson?.id ?? null}
          onSelect={handleSelect}
        />

        <main className="course-main">
          {lesson ? (
            <LessonView
              isComplete={isComplete(lesson.id)}
              lesson={lesson}
              onSelect={handleSelect}
              onToggleComplete={handleToggleComplete}
            />
          ) : (
            <>
              <CourseHome
                completed={completed}
                lastLessonId={lastLessonId}
                onSelect={handleSelect}
              />

              {completed.length > 0 ? (
                <button className="course-home__reset" onClick={reset} type="button">
                  Reset my progress
                </button>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}