import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
}

/**
 * Safely strips all HTML tags and returns plain text content.
 * Uses DOMPurify for secure parsing and extraction.
 */
export function stripHtmlTags(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // Strip all tags
    KEEP_CONTENT: true,
  });
  // DOMPurify with ALLOWED_TAGS: [] might still leave some tags if they are considered "content"
  // or if there's a misunderstanding of the API.
  // Actually, to get plain text, we can use the returnDOM option and then textContent.
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = clean;
  return tempDiv.textContent || tempDiv.innerText || '';
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
