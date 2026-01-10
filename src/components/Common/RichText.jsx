import React from 'react';
import { toRichSegments } from '../../utils/richText';

function TextBlock({ value, className }) {
  // Preserve newlines in plain text without forcing markdown parsing.
  return (
    <div className={`whitespace-pre-wrap ${className}`.trim()}>
      {value}
    </div>
  );
}

function CodeBlock({ value, isInverted = false, compact = false }) {
  const container = isInverted
    ? 'bg-white/10 border-white/20'
    : 'bg-surface border-border';

  const text = isInverted ? 'text-white' : 'text-text';

  return (
    <pre
      className={[
        'rounded-lg border',
        compact ? 'p-2 text-xs' : 'p-3 text-sm',
        'overflow-x-auto',
        'whitespace-pre',
        'font-mono',
        'leading-relaxed',
        container,
        text,
      ].join(' ')}
    >
      <code>{value}</code>
    </pre>
  );
}

export default function RichText({ text, className = '', isInverted = false, compact = false }) {
  const segments = toRichSegments(text);
  if (!segments.length) return null;

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {segments.map((seg, idx) => {
        if (seg.type === 'code') {
          return <CodeBlock key={idx} value={seg.value} isInverted={isInverted} compact={compact} />;
        }

        return (
          <TextBlock
            key={idx}
            value={seg.value}
            className={isInverted ? 'text-white' : 'text-text'}
          />
        );
      })}
    </div>
  );
}


