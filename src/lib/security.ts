import DOMPurify from 'dompurify'

/**
 * Escape HTML special characters so text can be safely embedded in HTML markup.
 */
export const escapeHtml = (s: string): string => {
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
export const sanitizeHtml = (dirty: string): string => {
  return String(
    DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        'b', 'i', 'em', 'strong', 'u', 's', 'sub', 'sup',
        'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'pre', 'code', 'a', 'span', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'name'],
      SANITIZE_NAMED_PROPS: true,
    }),
  )
}

/**
 * Sanitize text for safe rendering inside a React component.
 * Strips all HTML tags, returning plain text.
 */
export const sanitizeText = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

const isRelativeUrl = (trimmed: string): boolean =>
  trimmed.startsWith('/') && !trimmed.startsWith('//')

const isAllowedProtocol = (url: string, allowed: string[]): boolean => {
  try {
    const parsed = new URL(url)
    const normalized = parsed.protocol.toLowerCase()
    return allowed.some((p) => (p.endsWith(':') ? p.toLowerCase() : `${p.toLowerCase()}:`) === normalized)
  } catch {
    return false
  }
}

/**
 * Sanitize a URL to prevent XSS attacks via dangerous protocols or schemes
 * (e.g. javascript:, data:, vbscript:).
 *
 * Allows relative path URLs (starting with / but not //) and absolute URLs
 * matching allowed protocols (defaulting to http:, https:, mailto:, tel:).
 */
export const sanitizeUrl = (
  url: string,
  allowedProtocols: string[] = ['http:', 'https:', 'mailto:', 'tel:'],
): string => {
  if (typeof url !== 'string' || !url.trim() || url.includes('\\')) {
    return ''
  }

  const trimmed = url.trim()
  if (isRelativeUrl(trimmed)) {
    return trimmed
  }

  return isAllowedProtocol(trimmed, allowedProtocols) ? trimmed : ''
}
