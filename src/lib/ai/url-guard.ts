/**
 * Base-URL guards for the self-hosted AI providers.
 *
 * Both providers accept a user-configurable base URL, which is an SSRF sink:
 * without a host allowlist a stored settings record could point the app at an
 * arbitrary origin and relay the API key. Cloud hosts are the exception and
 * must be listed explicitly; everything else is confined to the local machine
 * (Ollama) or the local machine plus a known cloud host (Jev / Von).
 */

/** Hosts treated as "this machine" for a self-hosted provider. */
const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** Cloud origins accepted for the Jev base URL (TypeSafe hosted + OpenRouter passthrough). */
const ALLOWED_JEV_CLOUD_HOSTS = new Set(['api.typesafe.ai', 'openrouter.ai'])

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

/**
 * Validate and normalize a Jev base URL.
 *
 * Cloud URLs pass unconditionally; every other host must be localhost or a
 * `.local` hostname so a self-hosted Von server is reachable without opening
 * an SSRF path to arbitrary origins (same guard as {@link validateOllamaUrl}).
 */
export const validateJevBaseUrl = (baseUrl: string): string => {
  const url = parseHttpUrl(baseUrl, 'Jev')
  if (!ALLOWED_JEV_CLOUD_HOSTS.has(url.hostname) && !isAllowedLocalHost(url.hostname)) {
    throw new Error('Jev base URL must point to a known cloud host, localhost, or a .local hostname')
  }
  return baseUrl.replace(/\/+$/, '')
}
