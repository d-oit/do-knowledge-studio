/**
 * Safely escapes HTML special characters in a string to prevent XSS.
 * Replaces &, <, >, ", and ' with their corresponding HTML entities.
 */
export const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
