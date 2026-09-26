/**
 * Base-URL guard for the self-hosted Ollama provider.
 *
 * Ollama accepts a user-configured base URL, which is an SSRF sink: without a
 * host allowlist a stored settings record could point the app at an arbitrary
 * origin. The boundary is loopback plus `.local` names, so a user can reach an
 * Ollama instance on another machine on their own network (`pi.homelab.local`)
 * but never a public host. That is a deliberate trade: the alternative is
 * loopback-only, which would break the documented LAN use case.
 */

/**
 * Hosts accepted for the self-hosted provider.
 *
 * Only the bracketed IPv6 spelling appears in the loopback set: the sole caller
 * passes `URL.hostname`, which returns `[::1]`, never a bare `::1`.
 */
const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const isAllowedLocalHost = (hostname: string): boolean =>
  ALLOWED_LOCAL_HOSTS.has(hostname) || hostname.endsWith('.local')

/** Parse a base URL, rejecting anything that is not http(s). */
const parseHttpUrl = (baseUrl: string, label: string): URL => {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error(`Invalid ${label} base URL`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} base URL must use http or https protocol`)
  }
  return url
}

/** Validate and normalize an Ollama base URL to localhost-only. */
export const validateOllamaUrl = (baseUrl: string): string => {
  const url = parseHttpUrl(baseUrl, 'Ollama')
  if (!isAllowedLocalHost(url.hostname)) {
    throw new Error('Ollama base URL must point to localhost or a .local hostname')
  }
  return baseUrl.replace(/\/+$/, '')
}


