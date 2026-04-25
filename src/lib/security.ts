/**
 * Security utilities for the Knowledge Studio.
 */

/**
 * Escapes HTML special characters in a string to prevent XSS.
 * Handles <, >, &, ", and '.
 */
export const escapeHtml = (unsafe: string): string => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
