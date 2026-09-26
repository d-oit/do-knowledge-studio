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
 * `URL.hostname` returns a bracketed IPv6 literal (`[::1]`), not the bare
 * `::1`, so the bracketed entry is the one that can actually match — without
 * it, IPv6 loopback looks like an untrusted remote host and is rejected. The
 * bare spelling is kept for a caller that passes a hostname directly.
 */
const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

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


