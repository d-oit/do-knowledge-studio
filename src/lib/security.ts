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

const isInvalidUrlCandidate = (url: unknown): boolean =>
  typeof url !== 'string' || !url.trim() || url.includes('\\')

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
 * Strips ASCII control characters (0x00-0x1F, 0x7F) to prevent null byte,
 * CRLF, or obfuscated scheme bypasses.
 */
export const sanitizeUrl = (
  url: string,
  allowedProtocols: string[] = ['http:', 'https:', 'mailto:', 'tel:'],
): string => {
  if (isInvalidUrlCandidate(url)) {
    return ''
  }

  const sanitized = url.replace(/[\x00-\x1F\x7F]/g, '')
  if (isInvalidUrlCandidate(sanitized)) {
    return ''
  }

  const trimmed = sanitized.trim()
  if (isRelativeUrl(trimmed)) {
    return trimmed
  }

  return isAllowedProtocol(trimmed, allowedProtocols) ? trimmed : ''
}
