// Mirrors course_key / match_course in backend/api/curriculum.py so the UI and server agree on subject names.
const FILLER_PREFIXES = [
  'fundamentals of ', 'fundamental of ', 'introduction to ', 'intro to ', 'principles of ', 'basics of ',
  'advanced ', 'advance ',
];

export const courseKey = (value) => {
  let text = String(value ?? '').toLowerCase().replace(/&/g, ' and ').split(/\s+/).filter(Boolean).join(' ');
  const prefix = FILLER_PREFIXES.find((p) => text.startsWith(p));
  if (prefix) text = text.slice(prefix.length);
  const words = text.match(/[a-z0-9+#]+/g) || [];
  return words.map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)).join(' ');
};

/**
 * The course name in `courseNames` that `value` refers to, or null when it matches none (or is ambiguous).
 */
export const matchCourse = (value, courseNames = []) => {
  const key = courseKey(value);
  if (!key) return null;
  const byKey = new Map();
  courseNames.forEach((name) => {
    const k = courseKey(name);
    if (!byKey.has(k)) byKey.set(k, name);
  });
  if (byKey.has(key)) return byKey.get(key);
  const partial = [...byKey.entries()]
    .filter(([candidate]) => Math.min(key.length, candidate.length) >= 4 && (candidate.includes(key) || key.includes(candidate)))
    .map(([, name]) => name);
  return partial.length === 1 ? partial[0] : null;
};

export const normalizeSubject = (subject, courseNames = []) => {
  if (!subject || typeof subject !== 'string') return null;
  return matchCourse(subject, courseNames);
};

export const normalizeTopic = (topic) => {
  if (!topic || typeof topic !== 'string') return 'Unknown';
  const t = topic.trim();
  return t || 'Unknown';
};
