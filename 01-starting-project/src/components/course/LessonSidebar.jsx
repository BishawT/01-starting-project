import { COURSE } from '../../course/index.js';

/**
 * The lesson list, shown next to every course page.
 *
 * Two jobs beyond navigation: it shows where you are in the course (which
 * matters when a lesson is six minutes long and there are nine of them), and it
 * shows what you have already finished, so progress is visible without opening
 * anything.
 *
 * @param {{
 *   currentLessonId?: string | null,
 *   completed: string[],
 *   onSelect: (lessonId: string) => void,
 * }} props
 */
export default function LessonSidebar({ currentLessonId = null, completed, onSelect }) {
  const doneCount = COURSE.lessons.filter((lesson) => completed.includes(lesson.id)).length;

  return (
    <nav aria-label="Course lessons" className="course-sidebar">
      <p className="course-sidebar__progress">
        {doneCount} of {COURSE.lessons.length} lessons finished
      </p>

      <ol className="course-sidebar__list">
        {COURSE.lessons.map((lesson, index) => {
          const isCurrent = lesson.id === currentLessonId;
          const isDone = completed.includes(lesson.id);

          return (
            <li key={lesson.id}>
              <button
                aria-current={isCurrent ? 'page' : undefined}
                className={`course-sidebar__item${isCurrent ? ' is-current' : ''}${isDone ? ' is-done' : ''}`}
                onClick={() => onSelect(lesson.id)}
                type="button"
              >
                <span className="course-sidebar__number">
                  {isDone ? '✓' : index + 1}
                </span>

                <span className="course-sidebar__text">
                  <span className="course-sidebar__title">{lesson.title}</span>
                  <span className="course-sidebar__meta">
                    {lesson.minutes} min · {lesson.sections.length} sections
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}