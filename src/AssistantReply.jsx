import { Fragment } from 'react';
import { linkifyText } from './linkifyText.jsx';

function segmentSentences(text) {
  const t = String(text).trim();
  if (!t) return [];
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const seg = new Intl.Segmenter(undefined, { granularity: 'sentence' });
      return [...seg.segment(t)]
        .map((x) => x.segment.trim())
        .filter((x) => x.length > 0);
    } catch {
      /* ignore */
    }
  }
  return t
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Renders assistant text with light structure: double-newline paragraphs,
 * list blocks (-, *, •, or 1.), and long single-line replies split by sentence.
 */
export function AssistantReply({ text }) {
  const s = String(text ?? '');
  if (!s.trim()) return null;

  const blocks = s.split(/\n{2,}/);

  const isListLine = (line) =>
    /^\s*(?:[-*•]|\d+\.)\s+\S/.test(line);

  return (
    <div className="ew-assistant-reply">
      {blocks.map((block, blockIdx) => {
        const lines = block.split('\n');
        const nonempty = lines.map((l) => l.trimEnd()).filter((l) => l.trim());
        if (nonempty.length === 0) return null;

        const listBlock =
          nonempty.length >= 1 && nonempty.every((l) => isListLine(l));

        if (listBlock) {
          return (
            <ul
              key={blockIdx}
              className="ew-my-2 ew-list-disc ew-pl-4 ew-marker:text-[#333333] first:ew-mt-0 last:ew-mb-0 ew-space-y-0.5 [&>li]:ew-pl-0.5"
            >
              {nonempty.map((line, j) => {
                const item = line.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').trim();
                return (
                  <li key={j} className="ew-whitespace-pre-line">
                    {linkifyText(item, `li-${blockIdx}-${j}`)}
                  </li>
                );
              })}
            </ul>
          );
        }

        const trimmedBlock = block.trimEnd();
        const sentences = segmentSentences(trimmedBlock);
        const useSentenceParas =
          trimmedBlock.length > 140 &&
          !/\n/.test(trimmedBlock) &&
          sentences.length >= 2;

        if (useSentenceParas) {
          return (
            <Fragment key={blockIdx}>
              {sentences.map((sent, si) => (
                <p
                  key={si}
                  className="ew-mb-2 ew-whitespace-pre-line first:ew-mt-0 last:ew-mb-0"
                >
                  {linkifyText(sent, `s-${blockIdx}-${si}`)}
                </p>
              ))}
            </Fragment>
          );
        }

        return (
          <p
            key={blockIdx}
            className="ew-mb-2 ew-whitespace-pre-line first:ew-mt-0 last:ew-mb-0"
          >
            {linkifyText(trimmedBlock, `p-${blockIdx}`)}
          </p>
        );
      })}
    </div>
  );
}
