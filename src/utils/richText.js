const SQL_WORDS = [
  'select',
  'from',
  'where',
  'join',
  'left',
  'right',
  'inner',
  'outer',
  'group',
  'by',
  'having',
  'order',
  'insert',
  'into',
  'update',
  'delete',
  'create',
  'table',
  'alter',
  'drop',
  'values',
];

const CODE_WORDS = [
  // General
  'function',
  'return',
  'if',
  'else',
  'elif',
  'for',
  'while',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'throw',
  'import',
  'export',
  'class',
  'new',
  'public',
  'private',
  'protected',
  'static',
  'void',
  'int',
  'float',
  'double',
  'string',
  'boolean',
  // JavaScript/TS
  'console.log',
  'async',
  'await',
  // Python
  'def',
  'print',
  // PHP
  'echo',
  // C/C++
  '#include',
  'printf',
  'cout',
  'cin',
  'namespace',
  'std::',
  // Java
  'system.out',
];

function wordHitScore(text, words) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of words) {
    if (lower.includes(w)) hits += 1;
  }
  return hits;
}

function isLikelyPureCode(text) {
  const t = String(text || '').trim();
  if (!t) return false;

  // Strong starts (very likely code)
  if (/^\s*(<\?php\b|#include\b|import\b|from\b|using\b|public\b|private\b|protected\b|class\b|def\b)/i.test(t)) {
    return true;
  }
  if (/^\s*(select|create|insert|update|delete)\b/i.test(t)) return true;
  if (/^\s*<\/?[a-zA-Z][^>]*>/.test(t)) return true;
  if (/\bSystem\.out\.(print|println)\s*\(/.test(t)) return true;
  if (/\bconsole\.log\s*\(/.test(t)) return true;
  if (/\bint\s+main\s*\(/.test(t) || /\busing\s+namespace\s+\w+/.test(t)) return true;

  // If it contains a question mark, it’s probably natural language.
  if (t.includes('?')) return false;

  // Short & symbol-heavy lines are usually code.
  const words = (t.match(/[A-Za-z0-9_]+/g) || []).length;
  const symbols = (t.match(/[{}[\]();<>:=+\-*/%&|^!~]/g) || []).length;
  if (symbols >= 6 && words <= 20) return true;

  // SQL-ish single statement pattern
  if (t.endsWith(';') && /\b(create|select|insert|update|delete)\b/i.test(t)) return true;

  return false;
}

export function looksLikeCode(text) {
  if (!text) return false;
  const t = String(text).trim();
  if (!t) return false;

  // Explicit markdown fences
  if (t.includes('```')) return true;

  let score = 0;

  // HTML/XML-like
  if (/<\/?[a-zA-Z][^>]*>/.test(t)) score += 3;

  // Common code punctuation/operators
  if (/[{};]/.test(t)) score += 2;
  if (/==|!=|<=|>=|=>|->|::|<<|>>|\+\+|--/.test(t)) score += 2;
  if (/\(|\)/.test(t)) score += 1;
  if (/\bvar\b|\blet\b|\bconst\b/.test(t)) score += 1;

  // Language markers
  if (/^\s*#include\b/.test(t)) score += 4;
  if (/^\s*<\?php\b/i.test(t) || /\$\w+/.test(t)) score += 3;
  if (/^\s*def\s+\w+\s*\(/.test(t) || /^\s*class\s+\w+/.test(t)) score += 2;
  if (/\bSystem\.out\.(print|println)\s*\(/.test(t)) score += 3;
  if (/\bconsole\.log\s*\(/.test(t)) score += 3;
  if (/\bstd::\w+/.test(t) || /\busing\s+namespace\s+\w+/.test(t)) score += 2;
  if (/\bint\s+main\s*\(/.test(t)) score += 3;

  // SQL-ish
  if (/^\s*(select|create|insert|update|delete)\b/i.test(t)) score += 3;
  score += Math.min(2, wordHitScore(t, SQL_WORDS));

  // General code-ish words
  score += Math.min(2, wordHitScore(t, CODE_WORDS));

  // If it is very symbol-dense, it’s probably code.
  const symbols = (t.match(/[{}[\]();<>:=+\-*/%&|^!~]/g) || []).length;
  if (symbols >= 6) score += 2;

  return score >= 4;
}

function isCommentLike(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  return (
    t.startsWith('//') ||
    t.startsWith('/*') ||
    t.startsWith('*') ||
    t.startsWith('#') ||
    t.startsWith('--') ||
    t.startsWith('<!--')
  );
}

/**
 * Turns plain text into renderable segments.
 * Supports:
 * - Markdown fenced blocks: ```lang\ncode\n```
 * - Heuristic line-grouping for embedded code (no fences)
 */
export function toRichSegments(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return [];

  // 1) If user/data already uses fenced blocks, respect them.
  if (raw.includes('```')) {
    const segments = [];
    const re = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = re.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index);
      if (before.trim()) segments.push({ type: 'text', value: before });

      const lang = (match[1] || '').trim();
      const code = match[2] || '';
      segments.push({ type: 'code', value: code.trimEnd(), lang });

      lastIndex = match.index + match[0].length;
    }
    const after = raw.slice(lastIndex);
    if (after.trim()) segments.push({ type: 'text', value: after });
    return segments;
  }

  // 2) No fences: group consecutive "code-like" lines into blocks.
  const lines = raw.split(/\r?\n/);
  const segments = [];

  let bufferText = [];
  let bufferCode = [];

  const flushText = () => {
    const t = bufferText.join('\n');
    if (t.trim()) segments.push({ type: 'text', value: t });
    bufferText = [];
  };

  const flushCode = () => {
    const c = bufferCode.join('\n');
    if (c.trim()) segments.push({ type: 'code', value: c });
    bufferCode = [];
  };

  const strong = lines.map((l) => looksLikeCode(l) || isLikelyPureCode(l));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isBlank = trimmed.length === 0;

    // Keep blank lines inside an ongoing code block (helps readability).
    if (bufferCode.length && isBlank) {
      bufferCode.push(line);
      continue;
    }

    const neighborStrong = (strong[i - 1] || strong[i + 1]) === true;
    const indented = /^\s{2,}|\t/.test(line);

    const isCodeLine =
      strong[i] ||
      // Comment lines adjacent to code are usually part of the snippet.
      (isCommentLike(line) && neighborStrong) ||
      // Indented lines adjacent to code are usually part of the snippet.
      (indented && neighborStrong) ||
      // If we're already in a code block, allow slightly weaker lines to continue it.
      (bufferCode.length && (looksLikeCode(line) || isCommentLike(line) || /[{}();]/.test(line)));

    if (isCodeLine) {
      if (bufferText.length) flushText();
      bufferCode.push(line);
    } else {
      if (bufferCode.length) flushCode();
      bufferText.push(line);
    }
  }

  flushCode();
  flushText();

  // If we found no code blocks and this is very likely pure code,
  // treat it as a code block so it's easier to read.
  if (segments.length === 1 && segments[0].type === 'text' && isLikelyPureCode(raw) && looksLikeCode(raw)) {
    return [{ type: 'code', value: raw }];
  }

  return segments;
}


