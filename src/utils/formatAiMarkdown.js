/**
 * Normalize AI output so it renders cleanly as Markdown in the UI.
 * - Forces headings to "###" (project preference)
 * - Trims excessive blank lines
 */
export function formatAiMarkdown(raw) {
  if (!raw) return '';

  let text = String(raw);

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n');

  // Force headings to ### (convert # / ## / ####+ -> ###)
  text = text.replace(/^(#{1,6})\s+/gm, '### ');

  // Collapse 3+ newlines to 2 newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}


