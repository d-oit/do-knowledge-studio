/**
 * Base-URL guard for the self-hosted Ollama provider.
 *
 * Ollama accepts a user-configured base URL, which is an SSRF sink: without a
 * host allowlist a stored settings record could point the app at an arbitrary
 * origin. The allowlist confines every base URL to the local machine.
 */


/**
 * Hosts treated as "this machine" for the self-hosted provider.
 *
 * Only the bracketed IPv6 spelling appears here: the sole caller passes
 * `URL.hostname`, and that returns `[::1]` for a loopback URL, never the bare
 * `::1`. Listing the bare form would be dead allowlist data.
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


