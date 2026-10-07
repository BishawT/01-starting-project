// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Render the small subset of inline markup the lesson text uses:
//         **bold**, *italic*, `code`, and [links](https://…).
// WHERE:  01-starting-project/src/components/course/RichText.jsx
// WHY:    Lesson bodies are data — strings in a .js file, not JSX. This is the
//         one place they turn into elements.
//
// WHY NOT dangerouslySetInnerHTML
//   Because a lesson string containing HTML would then execute. This component
//   only ever creates elements it wrote itself, and the only attribute it can
//   emit is an href that is already proven to start with http:// or https://.
//   Lesson text can therefore never inject markup, no matter where it comes from.
// ────────────────────────────────────────────────────────────────────────────

import { Fragment } from 'react';

// Note the capture group around the whole alternation: String.split keeps
// captured groups, which is what gives us the markup pieces back separately
// from the plain text between them.
const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

function renderInline(part, key) {
  if (part.startsWith('**') && part.endsWith('**')) {
    // Recurse so **bold with `code` inside** still gets its code styled.
    return (
      <strong key={key}>
        <RichText>{part.slice(2, -2)}</RichText>
      </strong>
    );
  }

  if (part.startsWith('`') && part.endsWith('`')) {
    return (
      <code className="inline-code" key={key}>
        {part.slice(1, -1)}
      </code>
    );
  }

  if (part.startsWith('*') && part.endsWith('*')) {
    return (
      <em key={key}>
        <RichText>{part.slice(1, -1)}</RichText>
      </em>
    );
  }

  const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
  if (link) {
    return (
      <a href={link[2]} key={key} rel="noreferrer noopener" target="_blank">
        {link[1]}
      </a>
    );
  }

  return <Fragment key={key}>{part}</Fragment>;
}

/**
 * @param {{ children?: string }} props a plain string of lesson text.
 */
export default function RichText({ children }) {
  // Non-string children (numbers, null) pass straight through.
  if (typeof children !== 'string') {
    return children ?? null;
  }

  return children.split(INLINE_PATTERN).map(renderInline);
}