import RichText from './RichText.jsx';

/**
 * The self-test at the end of every lesson.
 *
 * Questions, not answers: the point is to make you go back to the code above and
 * check, rather than scroll to a solution. That is the same habit the rest of
 * this project is teaching — verify against the source, do not trust a claim.
 *
 * @param {{ items: string[] }} props
 */
export default function Checkpoint({ items }) {
  return (
    <section className="checkpoint">
      <h3 className="checkpoint__title">Check yourself</h3>

      <ol className="checkpoint__list">
        {items.map((item, index) => (
          <li key={index}>
            <RichText>{item}</RichText>
          </li>
        ))}
      </ol>

      <p className="checkpoint__hint">
        Answer these out loud, or in a comment. If you cannot, that is the lesson
        to reread — not a failure, just a signal.
      </p>
    </section>
  );
}