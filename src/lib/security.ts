import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]))$/i,
  });
}

/**
 * Safely strips all HTML tags and returns plain text content.
 * Uses DOMPurify for secure parsing and extraction.
 */
export function stripHtmlTags(html: string): string {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // Strip all tags
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true,
  });
  return fragment.textContent || '';
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
