import Callout from './Callout.jsx';
import Checkpoint from './Checkpoint.jsx';
import CodeBlock from './CodeBlock.jsx';
import RichText from './RichText.jsx';

/**
 * Render one lesson's `sections` array.
 *
 * Lesson files contain data, not markup. That means this component owns the
 * mapping from a section's `type` to a component, which has two useful
 * consequences: every section type is styled in one place, and a section with a
 * typo'd type degrades to a visible note rather than disappearing silently.
 *
 * @param {{ sections: object[] }} props
 */
export default function LessonBody({ sections }) {
  return (
    <div className="lesson-body">
      {sections.map((section, index) => {
        const key = `${section.type}-${index}`;

        switch (section.type) {
          case 'text':
            return (
              <section key={key}>
                {section.heading ? (
                  <h2 className="lesson-heading">
                    <RichText>{section.heading}</RichText>
                  </h2>
                ) : null}
                <p>
                  <RichText>{section.body}</RichText>
                </p>
              </section>
            );

          case 'code':
            return (
              <CodeBlock
                key={key}
                code={section.code}
                file={section.file}
                lang={section.lang}
                lines={section.lines}
                note={section.note}
              />
            );

          case 'list': {
            const ListTag = section.ordered ? 'ol' : 'ul';

            return (
              <ListTag className="lesson-list" key={key}>
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <RichText>{item}</RichText>
                  </li>
                ))}
              </ListTag>
            );
          }

          case 'table':
            return (
              <div className="lesson-table-wrapper" key={key}>
                <table className="lesson-table">
                  <thead>
                    <tr>
                      {section.head.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col">
                          <RichText>{cell}</RichText>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>
                            <RichText>{cell}</RichText>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'callout':
            return <Callout key={key} body={section.body} title={section.title} tone={section.tone} />;

          case 'checkpoint':
            return <Checkpoint key={key} items={section.items} />;

          case 'divider':
            return <hr className="lesson-divider" key={key} />;

          default:
            // Fail loudly, in the page, rather than rendering nothing.
            return (
              <p className="lesson-unknown" key={key}>
                Unknown section type: <code>{String(section.type)}</code>
              </p>
            );
        }
      })}
    </div>
  );
}