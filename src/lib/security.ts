import DOMPurify from 'dompurify'

/**
 * Escape HTML special characters so text can be safely embedded in HTML markup.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sanitize untrusted HTML using DOMPurify. Strips scripts, event handlers,
 * and any markup not on the allow-list.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 's', 'sub', 'sup',
      'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'a', 'span', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
  })
}

/**
 * Sanitize text for safe rendering inside a React component.
 * Strips all HTML tags, returning plain text.
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/**
 * Sanitize a URL to prevent XSS attacks via dangerous protocols or schemes
 * (e.g. javascript:, data:, vbscript:).
 *
 * Allows relative path URLs (starting with / but not //) and absolute URLs
 * matching allowed protocols (defaulting to http:, https:, mailto:, tel:).
 */
export function sanitizeUrl(
  url: string,
  allowedProtocols: string[] = ['http:', 'https:', 'mailto:', 'tel:'],
): string {
  if (!url || typeof url !== 'string') {
    return ''
  }

  const trimmed = url.trim()
  if (!trimmed) {
    return ''
  }

  // Allow safe site-relative paths (e.g. /path/to/page), blocking protocol-relative URLs (//evil.com) and backslash bypasses (/\evil.com)
  if (trimmed.startsWith('/') && !/^\/[/\\]/.test(trimmed)) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    const normalizedProtocol = parsed.protocol.toLowerCase()
    const normalizedAllowed = allowedProtocols.map((p) =>
      p.endsWith(':') ? p.toLowerCase() : `${p.toLowerCase()}:`,
    )

    if (normalizedAllowed.includes(normalizedProtocol)) {
      return trimmed
    }
  } catch {
    // Malformed URL
  }

  return ''
}
