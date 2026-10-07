// ─── PURPOSE ────────────────────────────────────────────────────────────────
// WHAT:   Display one code example: syntax highlighted, labelled with the real
//         file and line range it came from, and copyable.
// WHERE:  01-starting-project/src/components/course/CodeBlock.jsx
// WHY:    Every lesson claims "this exact code is in this exact file". Showing
//         the filename and lines makes that checkable instead of decorative.
//
// WHY A HAND-WRITTEN HIGHLIGHTER
//   A library like Prism or Shiki would be ~100kB of JavaScript (or a build
//   step) to colour about a dozen token types. The tokenizer below is ~40 lines
//   and handles what these lessons actually contain. It is a display-only
//   concern: highlighting is never allowed to change what the code means, and
//   nothing here evaluates anything.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';

import RichText from './RichText.jsx';

// Each rule is [tokenType, stickyRegex]. Sticky ('y') means "only match at
// exactly this index", which is what makes a linear scan possible.
const JS_RULES = [
  ['comment', /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y],
  ['string', /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/y],
  ['tag', /<\/?[A-Za-z][\w.]*|<\/?>|\/>/y],
  ['number', /0[xX][\w]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
  ['literal', /\b(?:true|false|null|undefined|NaN)\b/y],
  [
    'keyword',
    /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|of|in|new|class|extends|import|export|from|as|default|async|await|try|catch|finally|throw|typeof|instanceof|delete|void|yield|static)\b/y,
  ],
  ['property', /\.[A-Za-z_$][\w$]*/y],
  ['fn', /[A-Za-z_$][\w$]*(?=\s*\()/y],
];

const BASH_RULES = [
  ['comment', /#[^\n]*/y],
  ['string', /'[^']*'|"[^"]*"/y],
  ['builtin', /\b(?:npm|node|npx|psql|cd|ls|mkdir|git)\b/y],
  ['flag', /--?[\w-]+/y],
];

const SQL_RULES = [
  ['comment', /--[^\n]*/y],
  ['string', /'[^']*'/y],
  [
    'keyword',
    /\b(?:SELECT|FROM|INSERT|INTO|VALUES|UPDATE|SET|DELETE|WHERE|AND|OR|NOT|JOIN|ON|AS|ORDER|BY|LIMIT|CURRENT_TIMESTAMP|RETURNING|NOT|IN|NULL|TABLE|IF|EXISTS|PRIMARY|KEY|UNIQUE|TEXT|TIMESTAMPTZ)\b/iy,
  ],
  ['number', /\b\d+(?:\.\d+)?\b/y],
];

const RULES_BY_LANGUAGE = {
  js: JS_RULES,
  jsx: JS_RULES,
  bash: BASH_RULES,
  sql: SQL_RULES,
  text: null,
};

/**
 * Split source into a flat list of typed tokens.
 *
 * This is a single left-to-right pass: at every position it tries each rule in
 * order, and on a match emits a token; on no match it advances one character.
 * Unknown languages fall back to no highlighting, which is correct behaviour —
 * unstyled code is still readable.
 *
 * @param {string} source
 * @param {string} language
 * @returns {{ type: string, value: string }[]}
 */
function tokenize(source, language) {
  const rules = RULES_BY_LANGUAGE[language];

  if (!rules) {
    return [{ type: 'plain', value: source }];
  }

  const tokens = [];
  let index = 0;
  let plainStart = 0;

  while (index < source.length) {
    let matched = null;

    for (const [type, pattern] of rules) {
      pattern.lastIndex = index;
      const match = pattern.exec(source);

      if (match) {
        matched = { type, value: match[0] };
        break;
      }
    }

    if (!matched) {
      index += 1;
      continue;
    }

    if (index > plainStart) {
      tokens.push({ type: 'plain', value: source.slice(plainStart, index) });
    }

    // The property rule matches the leading dot too. Split it so the dot keeps
    // the surrounding text colour and only the name is highlighted.
    if (matched.type === 'property') {
      tokens.push({ type: 'plain', value: matched.value[0] });
      tokens.push({ type: 'property', value: matched.value.slice(1) });
    } else {
      tokens.push(matched);
    }

    index += matched.value.length;
    plainStart = index;
  }

  if (plainStart < source.length) {
    tokens.push({ type: 'plain', value: source.slice(plainStart) });
  }

  return tokens;
}

/**
 * Copy to clipboard, with a fallback for browsers that refuse the async API.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers, or an insecure origin. The textarea dance still works.
    const scratchpad = document.createElement('textarea');
    scratchpad.value = text;
    scratchpad.setAttribute('readonly', '');
    scratchpad.style.position = 'fixed';
    scratchpad.style.opacity = '0';
    document.body.appendChild(scratchpad);
    scratchpad.select();

    try {
      document.execCommand('copy');
    } catch {
      /* nothing more we can do — the button simply will not confirm */
    }

    document.body.removeChild(scratchpad);
  }
}

/**
 * @param {{
 *   code: string,
 *   lang?: string,
 *   file?: string,
 *   lines?: string,
 *   note?: string,
 * }} props
 */
export default function CodeBlock({ code, lang = 'js', file, lines, note }) {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef(null);

  // Clear the pending "Copied!" timer if the component unmounts first, so we
  // never call setState on a dead component.
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(() => {
    copyToClipboard(code);
    setIsCopied(true);

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setIsCopied(false), 1600);
  }, [code]);

  const tokens = tokenize(code, lang);

  return (
    <figure className="code-block">
      {(file || note) && (
        <figcaption className="code-block__bar">
          {file ? (
            <span className="code-block__file">
              <span className="code-block__path">{file}</span>
              {lines ? <span className="code-block__lines">{lines}</span> : null}
            </span>
          ) : (
            <span className="code-block__file" />
          )}

          <button className="code-block__copy" type="button" onClick={handleCopy}>
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </figcaption>
      )}

      <pre className="code-block__pre">
        <code>
          {tokens.map((token, index) => (
            <span className={`tok tok--${token.type}`} key={index}>
              {token.value}
            </span>
          ))}
        </code>
      </pre>

      {note ? (
        <p className="code-block__note">
          <RichText>{note}</RichText>
        </p>
      ) : null}
    </figure>
  );
}