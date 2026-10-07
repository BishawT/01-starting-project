import { COURSE, TOTAL_MINUTES, getLesson } from '../../course/index.js';
import RichText from './RichText.jsx';

/**
 * The course landing page: what this is, where to start, and what is left.
 *
 * @param {{
 *   completed: string[],
 *   lastLessonId: string | null,
 *   onSelect: (lessonId: string) => void,
 * }} props
 */
export default function CourseHome({ completed, lastLessonId, onSelect }) {
  const doneCount = COURSE.lessons.filter((lesson) => completed.includes(lesson.id)).length;
  const percentDone = Math.round((doneCount / COURSE.lessons.length) * 100);

  // Offer to resume only if that lesson still exists — a stale id from an older
  // version of the course must not produce a dead button.
  const resumeLesson = getLesson(lastLessonId);
  const nextLesson =
    COURSE.lessons.find((lesson) => !completed.includes(lesson.id)) ?? COURSE.lessons[0];

  return (
    <div className="course-home">
      <p className="course-home__eyebrow">{COURSE.level} · {TOTAL_MINUTES} minutes total</p>
      <h2 className="course-home__title">{COURSE.title}</h2>
      <p className="course-home__tagline">{COURSE.tagline}</p>
      <p className="course-home__description">
        <RichText>{COURSE.description}</RichText>
      </p>

      <div className="course-home__actions">
        {resumeLesson && doneCount > 0 ? (
          <button
            className="button"
            onClick={() => onSelect(resumeLesson.id)}
            type="button"
          >
            Continue: {resumeLesson.title}
          </button>
        ) : null}

        <button className="button" onClick={() => onSelect(nextLesson.id)} type="button">
          {doneCount === 0 ? 'Start lesson 1' : `Next: ${nextLesson.title}`}
        </button>
      </div>

      {doneCount > 0 ? (
        <div className="course-home__progress">
          <div className="course-home__progress-track">
            <div
              className="course-home__progress-fill"
              style={{ width: `${percentDone}%` }}
            />
          </div>
          <p className="course-home__progress-label">
            {percentDone}% complete · saved in this browser
          </p>
        </div>
      ) : null}

      <h3 className="course-home__list-heading">Lessons</h3>

      <ul className="course-home__cards">
        {COURSE.lessons.map((lesson, index) => {
          const isDone = completed.includes(lesson.id);

          return (
            <li key={lesson.id}>
              <button
                className={`course-card${isDone ? ' is-done' : ''}`}
                onClick={() => onSelect(lesson.id)}
                type="button"
              >
                <span className="course-card__number">
                  {isDone ? '✓' : index + 1}
                </span>

                <span className="course-card__body">
                  <span className="course-card__title">{lesson.title}</span>
                  <span className="course-card__goal">
                    <RichText>{lesson.goal}</RichText>
                  </span>
                </span>

                <span className="course-card__minutes">{lesson.minutes} min</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="course-home__footnote">
        Lessons are read-only — nothing here changes how the app works. When a lesson
        says “your <code>AuthInputs.jsx</code>”, it means{' '}
        <code>01-starting-project/src/components/AuthInputs.jsx</code>.
      </p>
    </div>
  );
}