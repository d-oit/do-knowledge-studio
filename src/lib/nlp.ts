/**
 * Simple NLP utilities for text processing and semantic compression.
 */

/**
 * Removes HTML tags from a string.
 */
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>?/gm, ' ');
};

/**
 * Standard English stop words.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'from', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'to', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'once', 'here', 'there', 'where', 'why', 'how',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'can', 'will', 'just', 'should', 'now', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'of', 'for', 'this'
]);

/**
 * Removes stop words from a string.
 */
export const removeStopWords = (text: string): string => {
  return text
    .split(/\s+/)
    .filter(word => word && !STOP_WORDS.has(word.toLowerCase()))
    .join(' ');
};

/**
 * Compresses text by stripping HTML, removing stop words, and trimming.
 * This keeps the Orama search index minimal.
 */
export const compressText = (text: string, maxLength: number = 200): string => {
  if (!text) return '';

  const cleanText = stripHtml(text);
  const withoutStopWords = removeStopWords(cleanText);
  const trimmed = withoutStopWords.trim().replace(/\s+/g, ' ');

  if (trimmed.length <= maxLength) return trimmed;

  // Try to cut at word boundary
  const cutIndex = trimmed.lastIndexOf(' ', maxLength);
  const actualCut = cutIndex > 0 ? cutIndex : maxLength;

  return trimmed.substring(0, actualCut).trim() + '...';
};
