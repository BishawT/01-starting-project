import { COURSE, getLessonNeighbours } from '../../course/index.js';
import LessonBody from './LessonBody.jsx';
import RichText from './RichText.jsx';

/**
 * One lesson, rendered as a page.
 *
 * A lesson is deliberately short — one idea, one or two code examples, one
 * self-test. The footer carries the lesson title of the previous and next page
 * so you always know where you are before you click.
 *
 * @param {{
 *   lesson: object,
 *   isComplete: boolean,
 *   onSelect: (lessonId: string) => void,
 *   onToggleComplete: (lessonId: string) => void,
 * }} props
 */
export default function LessonView({ lesson, isComplete, onSelect, onToggleComplete }) {
  const { previous, next } = getLessonNeighbours(lesson.id);

  return (
    <article className="lesson">
      <header className="lesson__header">
        <p className="lesson__eyebrow">
          {COURSE.title} · {lesson.minutes} min read
        </p>

        <h1 className="lesson__title">{lesson.title}</h1>

        <p className="lesson__goal">
          <strong>By the end you can:</strong> <RichText>{lesson.goal}</RichText>
        </p>

        <label className="lesson__done">
          <input
            checked={isComplete}
            onChange={() => onToggleComplete(lesson.id)}
            type="checkbox"
          />
          <span>{isComplete ? 'Marked as finished' : 'Mark as finished'}</span>
        </label>
      </header>

      <LessonBody sections={lesson.sections} />

      <footer className="lesson__footer">
        {previous ? (
          <button
            className="lesson-nav lesson-nav--previous"
            onClick={() => onSelect(previous.id)}
            type="button"
          >
            <span className="lesson-nav__label">← Previous</span>
            <span className="lesson-nav__title">{previous.title}</span>
          </button>
        ) : (
          <span />
        )}

        {next ? (
          <button
            className="lesson-nav lesson-nav--next"
            onClick={() => onSelect(next.id)}
            type="button"
          >
            <span className="lesson-nav__label">Next →</span>
            <span className="lesson-nav__title">{next.title}</span>
          </button>
        ) : (
          <button className="lesson-nav lesson-nav--next" onClick={() => onSelect(null)} type="button">
            <span className="lesson-nav__label">Finished</span>
            <span className="lesson-nav__title">Back to course</span>
          </button>
        )}
      </footer>
    </article>
  );
}