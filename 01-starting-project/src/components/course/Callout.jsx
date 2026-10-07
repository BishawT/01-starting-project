import RichText from './RichText.jsx';

/**
 * A boxed aside inside a lesson.
 *
 * Lessons use three tones, and each one means exactly one thing:
 *   note  — extra context or a gotcha worth remembering
 *   warn  — a mistake that actually breaks things
 *   good  — the good way to do it, for contrast
 *
 * @param {{
 *   tone?: 'note' | 'warn' | 'good',
 *   title?: string,
 *   body?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function Callout({ tone = 'note', title, body, children }) {
  return (
    <aside className={`callout callout--${tone}`}>
      {title ? <p className="callout__title">{title}</p> : null}
      {body ? (
        <p className="callout__body">
          <RichText>{body}</RichText>
        </p>
      ) : null}
      {children}
    </aside>
  );
}