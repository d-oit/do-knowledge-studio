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
  if (!url || typeof url !== 'string') {
    return ''
  }

  const trimmed = url.trim()
  if (!trimmed) {
    return ''
  }

  // Browsers normalize backslashes to slashes when resolving hrefs, so a URL
  // like `https:/\\evil.com` would render as `https://evil.com`. Reject any
  // backslash outright to close that bypass (defense in depth).
  if (trimmed.includes('\\')) {
    return ''
  }

  // Allow safe site-relative paths (e.g. /path/to/page). A leading slash
  // binds the URL to the current origin, so it can never become a scheme in
  // an href context — `javascript:` requires a scheme before the first slash.
  // Protocol-relative (//evil.com) is rejected; backslash variants were
  // already rejected above (browsers normalize \ to /).
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
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
    return ''
  } catch {
    // Malformed or unsupported URL — treat as unsafe.
    return ''
  }
}
