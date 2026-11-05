/**
 * ICE server configuration for peer-to-peer rooms (#1052).
 *
 * A room that only has STUN cannot connect peers behind symmetric NAT or a
 * strict corporate firewall; a TURN relay is the only way through. This module
 * owns the shape, validation and redaction of that configuration so the sync
 * view, the persistence layer and the WebRTC provider all agree on it.
 *
 * Credentials are part of an ICE server record. Validation rejects any attempt
 * to smuggle them inside a URL (`turn:user:pass@host`), because that string
 * ends up in invites, QR codes and logs (ADR 045). Anything that leaves this
 * module for display goes through {@link redactIceServers}.
 */
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for ICE configuration logs. */
const log = logger.child({ area: 'sync' })

/** URL schemes a WebRTC ICE server may use. */
export const ICE_URL_SCHEMES = ['stun', 'stuns', 'turn', 'turns'] as const
/** A validated ICE URL scheme. */
export type IceUrlScheme = (typeof ICE_URL_SCHEMES)[number]

/** Upper bound on configured servers, so a pasted blob cannot become config. */
export const MAX_ICE_SERVERS = 8
/** Upper bound on URLs sharing one credential set. */
export const MAX_ICE_URLS_PER_SERVER = 4

/** Hosts whose plaintext TURN endpoint never leaves the machine. */
const LOOPBACK_HOSTS: Record<string, true> = {
  localhost: true,
  '127.0.0.1': true,
  '[::1]': true,
  '::1': true,
}

/** `scheme:rest`, where `rest` is the authority plus optional transport query. */
const ICE_URL_PATTERN = /^([a-z]+):(\S+)$/i
/** Host, optional port, optional `?transport=udp|tcp` (RFC 7065). */
const ICE_AUTHORITY_PATTERN =
  /^(\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)(?::(\d{1,5}))?(?:\?transport=(?:udp|tcp))?$/

/** One ICE server: URLs plus the optional long-term credential TURN needs. */
export interface IceServerConfig {
  urls: string[]
  username?: string
  credential?: string
}

/** Why a submitted ICE configuration was rejected. */
export type IceConfigIssueCode =
  | 'shape'
  | 'empty'
  | 'malformed-url'
  | 'unsupported-scheme'
  | 'credentials-in-url'
  | 'insecure-turn'
  | 'missing-credentials'
  | 'too-many-servers'
  | 'too-many-urls'

/** One rejected field. `message` never echoes a credential. */
export interface IceConfigIssue {
  code: IceConfigIssueCode
  /** Index of the offending server, or -1 for a list-level problem. */
  index: number
  message: string
}

/** Validation outcome for a submitted ICE server list. */
export type IceConfigResult =
  | { ok: true; servers: IceServerConfig[] }
  | { ok: false; issues: IceConfigIssue[] }

/** Options that relax a rule the user can deliberately override. */
export interface ValidateIceServersOptions {
  /** Allow plaintext `turn:` URLs to non-loopback hosts (lab setups). */
  allowInsecureTurn?: boolean
}

/** A parsed ICE URL, narrowed to the parts validation and diagnostics need. */
interface ParsedIceUrl {
  scheme: IceUrlScheme
  host: string
  secure: boolean
}

/** Result of parsing one ICE URL. */
type IceUrlResult = { ok: true; value: ParsedIceUrl } | { ok: false; code: IceConfigIssueCode }

/** Whether a parsed host only ever reaches the local machine. */
const isLoopbackHost = (host: string): boolean => LOOPBACK_HOSTS[host.toLowerCase()] === true

/**
 * Parses one ICE URL.
 *
 * `new URL()` is deliberately not used: `stun:`/`turn:` are not special schemes,
 * so WHATWG parsing yields an empty hostname and would accept nonsense.
 */
const parseIceUrl = (raw: string): IceUrlResult => {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, code: 'empty' }
  const match = ICE_URL_PATTERN.exec(trimmed)
  if (match === null) return { ok: false, code: 'malformed-url' }
  const scheme = (match[1] ?? '').toLowerCase()
  const rest = match[2] ?? ''
  if (!(ICE_URL_SCHEMES as readonly string[]).includes(scheme)) {
    return { ok: false, code: 'unsupported-scheme' }
  }
  // Credentials belong in username/credential fields, never in a URL that is
  // displayed, copied into an invite or written to a log (ADR 045).
  if (rest.includes('@')) return { ok: false, code: 'credentials-in-url' }
  const authority = ICE_AUTHORITY_PATTERN.exec(rest)
  if (authority === null) return { ok: false, code: 'malformed-url' }
  const host = authority[1] ?? ''
  const typedScheme = scheme as IceUrlScheme
  return {
    ok: true,
    value: { scheme: typedScheme, host, secure: typedScheme === 'stuns' || typedScheme === 'turns' },
  }
}

/** Reads an optional non-empty string field, rejecting non-string values. */
const readOptionalSecret = (
  record: Record<string, unknown>,
  key: 'username' | 'credential',
): { ok: true; value: string | undefined } | { ok: false } => {
  const value = record[key]
  if (value === undefined || value === null) return { ok: true, value: undefined }
  if (typeof value !== 'string') return { ok: false }
  return { ok: true, value: value === '' ? undefined : value }
}

/** Human-readable, credential-free explanation for a rejected URL. */
const URL_ISSUE_MESSAGES: Record<string, string> = {
  empty: 'An ICE URL cannot be empty.',
  'malformed-url': 'Use a URL like stun:host:3478 or turns:relay.example.com:5349.',
  'unsupported-scheme': 'Only stun:, stuns:, turn: and turns: URLs are supported.',
  'credentials-in-url': 'Put TURN credentials in the username and credential fields, not in the URL.',
  'insecure-turn':
    'Plaintext turn: relays expose credentials on the network. Use turns:, or allow insecure TURN explicitly.',
}

/** Turns one server entry into validated config, accumulating issues. */
const validateServer = (
  candidate: unknown,
  index: number,
  options: ValidateIceServersOptions,
  issues: IceConfigIssue[],
): IceServerConfig | null => {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    issues.push({ code: 'shape', index, message: 'Each ICE server must be an object with urls.' })
    return null
  }
  const record = candidate as Record<string, unknown>
  const rawUrls = record.urls
  const list = typeof rawUrls === 'string' ? [rawUrls] : rawUrls
  if (!Array.isArray(list) || list.length === 0) {
    issues.push({ code: 'shape', index, message: 'Each ICE server needs at least one URL.' })
    return null
  }
  if (list.length > MAX_ICE_URLS_PER_SERVER) {
    issues.push({
      code: 'too-many-urls',
      index,
      message: `Use at most ${MAX_ICE_URLS_PER_SERVER} URLs per ICE server.`,
    })
    return null
  }
  const username = readOptionalSecret(record, 'username')
  const credential = readOptionalSecret(record, 'credential')
  if (!username.ok || !credential.ok) {
    issues.push({ code: 'shape', index, message: 'ICE credentials must be text.' })
    return null
  }

  const urls: string[] = []
  let needsCredential = false
  for (const rawUrl of list) {
    if (typeof rawUrl !== 'string') {
      issues.push({ code: 'shape', index, message: 'Each ICE URL must be text.' })
      continue
    }
    const parsed = parseIceUrl(rawUrl)
    if (!parsed.ok) {
      issues.push({
        code: parsed.code,
        index,
        message: URL_ISSUE_MESSAGES[parsed.code] ?? 'That ICE URL is not valid.',
      })
      continue
    }
    const { scheme, host } = parsed.value
    if (scheme === 'turn' || scheme === 'turns') needsCredential = true
    if (scheme === 'turn' && !options.allowInsecureTurn && !isLoopbackHost(host)) {
      issues.push({ code: 'insecure-turn', index, message: URL_ISSUE_MESSAGES['insecure-turn'] ?? '' })
      continue
    }
    const normalized = rawUrl.trim()
    if (!urls.includes(normalized)) urls.push(normalized)
  }

  if (needsCredential && (username.value === undefined || credential.value === undefined)) {
    issues.push({
      code: 'missing-credentials',
      index,
      message: 'A TURN server needs both a username and a credential.',
    })
  }
  if (urls.length === 0) return null
  return {
    urls,
    ...(username.value === undefined ? {} : { username: username.value }),
    ...(credential.value === undefined ? {} : { credential: credential.value }),
  }
}

/**
 * Validates a submitted ICE server list.
 *
 * Rejects: malformed URLs, schemes other than stun/stuns/turn/turns,
 * credentials embedded in a URL, plaintext TURN to a non-loopback host unless
 * `allowInsecureTurn` is set, and TURN without a username/credential pair.
 */
export const validateIceServers = (
  input: unknown,
  options: ValidateIceServersOptions = {},
): IceConfigResult => {
  if (!Array.isArray(input)) {
    return { ok: false, issues: [{ code: 'shape', index: -1, message: 'ICE servers must be a list.' }] }
  }
  if (input.length > MAX_ICE_SERVERS) {
    return {
      ok: false,
      issues: [
        { code: 'too-many-servers', index: -1, message: `Use at most ${MAX_ICE_SERVERS} ICE servers.` },
      ],
    }
  }
  const issues: IceConfigIssue[] = []
  const servers: IceServerConfig[] = []
  const seen = new Set<string>()
  for (const [index, candidate] of input.entries()) {
    const server = validateServer(candidate, index, options, issues)
    if (server === null) continue
    const key = JSON.stringify([server.urls, server.username ?? '', server.credential ?? ''])
    if (seen.has(key)) continue
    seen.add(key)
    servers.push(server)
  }
  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, servers }
}

/** Credential-free form of an ICE server, safe to render or log. */
export interface RedactedIceServer {
  urls: string[]
  /** Whether a TURN credential is configured; the value itself never leaves storage. */
  authenticated: boolean
}

/** Maps configured servers to a display-safe shape. */
export const redactIceServers = (
  servers: readonly IceServerConfig[],
): RedactedIceServer[] =>
  servers.map((server) => ({
    urls: [...server.urls],
    authenticated: server.username !== undefined && server.credential !== undefined,
  }))

/** Converts validated config into the shape `RTCPeerConnection` accepts. */
export const toRtcIceServers = (servers: readonly IceServerConfig[]): RTCIceServer[] =>
  servers.map((server) => ({
    urls: [...server.urls],
    ...(server.username === undefined ? {} : { username: server.username }),
    ...(server.credential === undefined ? {} : { credential: server.credential }),
  }))

/** Whether two ICE lists describe the same configuration. */
export const sameIceServers = (
  a?: readonly IceServerConfig[],
  b?: readonly IceServerConfig[],
): boolean => JSON.stringify(a ?? []) === JSON.stringify(b ?? [])

/**
 * Reads `NEXT_PUBLIC_ICE_SERVERS` (a JSON array) for self-hosted defaults.
 * Invalid configuration is ignored with a warning rather than crashing boot.
 */
export const parseIceServersEnv = (raw: string | undefined): IceServerConfig[] => {
  const value = raw?.trim()
  if (!value) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (error) {
    log.warn('NEXT_PUBLIC_ICE_SERVERS is not valid JSON; ignoring it', { error })
    return []
  }
  const result = validateIceServers(parsed)
  if (!result.ok) {
    log.warn('NEXT_PUBLIC_ICE_SERVERS failed validation; ignoring it', {
      codes: result.issues.map((issue) => issue.code),
    })
    return []
  }
  return result.servers
}

/** ICE servers configured for this deployment through the environment. */
export const DEFAULT_ICE_SERVERS: readonly IceServerConfig[] = parseIceServersEnv(
  process.env.NEXT_PUBLIC_ICE_SERVERS,
)
