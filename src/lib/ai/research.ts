const JINA_READER_ENDPOINT = 'https://r.jina.ai/'
const URL_REGEX = /https?:\/\/[^\s<>")\]]+/gi
const MAX_CONTENT_LENGTH = 8000

// Private and reserved network constants for IPv4
const IPV4_CLASS_A_PRIVATE = 10
const IPV4_LOOPBACK_BYTE = 127
const IPV4_LOCAL_NET_BYTE = 0
const IPV4_CLASS_C_PRIVATE = 0xC0A8 // 192.168
const IPV4_LINK_LOCAL = 0xA9FE // 169.254
const IPV4_CLASS_B_PRIVATE_PREFIX = 0xAC1 // 172.16
const IPV4_CARRIER_NAT_PREFIX = 401 // 100.64
const IPV4_IANA_SPECIAL = 0xC00000 // 192.0.0
const IPV4_IANA_SPECIAL_2 = 0xC00002 // 192.0.2
const IPV4_IANA_SPECIAL_3 = 0xC63364 // 198.51.100
const IPV4_IANA_SPECIAL_4 = 0xCB0071 // 203.0.113
const IPV4_MULTICAST_NIBBLE = 14 // 224.0.0.0/4
const IPV4_RESERVED_NIBBLE = 15 // 240.0.0.0/4

function parseIPv4(hostname: string): number | null {
  if (!/^[0-9a-f.x]+$/i.test(hostname)) {
    return null
  }

  const parts = hostname.split('.')
  if (parts.length > 4 || parts.length === 0) {
    return null
  }

  const values: number[] = []
  for (const part of parts) {
    if (part === '') return null
    let val: number
    if (part.toLowerCase().startsWith('0x')) {
      val = parseInt(part, 16)
    } else if (part.startsWith('0') && part.length > 1) {
      if (/[89]/.test(part)) {
        return null
      }
      val = parseInt(part, 8)
    } else {
      val = parseInt(part, 10)
    }

    if (isNaN(val) || val < 0 || val > 0xffffffff) {
      return null
    }
    values.push(val)
  }

  const len = values.length
  for (let i = 0; i < len - 1; i++) {
    if (values[i] > 255) return null
  }

  let ipVal = 0
  if (len === 4) {
    if (values[3] > 255) return null
    ipVal = (values[0] << 24) | (values[1] << 16) | (values[2] << 8) | values[3]
  } else if (len === 3) {
    if (values[2] > 65535) return null
    ipVal = (values[0] << 24) | (values[1] << 16) | values[2]
  } else if (len === 2) {
    if (values[1] > 16777215) return null
    ipVal = (values[0] << 24) | values[1]
  } else if (len === 1) {
    ipVal = values[0]
  }

  return ipVal >>> 0
}

function isPrivateIPv4(ipVal: number): boolean {
  const byte1 = ipVal >>> 24
  if (byte1 === IPV4_CLASS_A_PRIVATE) return true
  if (byte1 === IPV4_LOOPBACK_BYTE) return true
  if (byte1 === IPV4_LOCAL_NET_BYTE) return true

  const byte12 = ipVal >>> 16
  if (byte12 === IPV4_CLASS_C_PRIVATE) return true
  if (byte12 === IPV4_LINK_LOCAL) return true

  if ((ipVal >>> 20) === IPV4_CLASS_B_PRIVATE_PREFIX) return true
  if ((ipVal >>> 22) === IPV4_CARRIER_NAT_PREFIX) return true

  const byte123 = ipVal >>> 8
  if (byte123 === IPV4_IANA_SPECIAL) return true
  if (byte123 === IPV4_IANA_SPECIAL_2) return true
  if (byte123 === IPV4_IANA_SPECIAL_3) return true
  if (byte123 === IPV4_IANA_SPECIAL_4) return true

  const byte1_nibble = byte1 >>> 4
  if (byte1_nibble === IPV4_MULTICAST_NIBBLE) return true
  if (byte1_nibble === IPV4_RESERVED_NIBBLE) return true

  return false
}

function isPrivateIPv6(normalized: string): boolean {
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized === '0:0:0:0:0:0:0:0'
  ) {
    return true
  }

  const ipv4MappedMatch = normalized.match(/^::ffff:(.+)$/i)
  if (ipv4MappedMatch) {
    const ipv4Part = ipv4MappedMatch[1]
    const parsed = parseIPv4(ipv4Part)
    if (parsed !== null) {
      return isPrivateIPv4(parsed)
    }
  }

  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) {
    return true
  }

  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return true
  }

  if (/^ff[0-9a-f]{2}:/i.test(normalized)) {
    return true
  }

  return false
}

export function isPrivateIP(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[(.+)\]$/, '$1')

  if (normalized === 'localhost') {
    return true
  }

  if (
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.lan') ||
    normalized.endsWith('.test') ||
    normalized.endsWith('.invalid') ||
    normalized.endsWith('.example') ||
    normalized.endsWith('.onion')
  ) {
    return true
  }

  const ipv4Val = parseIPv4(normalized)
  if (ipv4Val !== null) {
    return isPrivateIPv4(ipv4Val)
  }

  if (isPrivateIPv6(normalized)) {
    return true
  }

  if (!normalized.includes('.') && !normalized.includes(':')) {
    return true
  }

  return false
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  if (!matches) return []
  return [...new Set(matches)].filter((url) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false
      }
      return !isPrivateIP(parsed.hostname)
    } catch {
      return false
    }
  })
}

export interface ResearchResult {
  url: string
  title: string
  content: string
  success: boolean
  error?: string
}

export async function fetchUrlContent(
  url: string,
  signal?: AbortSignal,
): Promise<ResearchResult> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked URL scheme: ${parsed.protocol}`)
    }
    if (isPrivateIP(parsed.hostname)) {
      throw new Error(`Blocked private/reserved IP or local domain: ${parsed.hostname}`)
    }

    const encodedUrl = encodeURIComponent(url)
    const res = await fetch(`${JINA_READER_ENDPOINT}${encodedUrl}`, {
      headers: {
        Accept: 'text/markdown',
      },
      signal,
    })

    if (!res.ok) {
      return {
        url,
        title: '',
        content: '',
        success: false,
        error: `Jina Reader error ${res.status}`,
      }
    }

    const text = await res.text()
    const titleMatch = text.match(/^#\s+(.+)/m)
    const title = titleMatch?.[1] ?? new URL(url).hostname
    const content = text.length > MAX_CONTENT_LENGTH
      ? text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated]'
      : text

    return { url, title, content, success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { url, title: '', content: '', success: false, error: msg }
  }
}

export async function fetchUrls(
  urls: string[],
  signal?: AbortSignal,
): Promise<ResearchResult[]> {
  return Promise.all(urls.map((url) => fetchUrlContent(url, signal)))
}

export function buildResearchContext(results: ResearchResult[]): string {
  const successful = results.filter((r) => r.success)
  if (successful.length === 0) return ''

  const parts = successful.map((r) => {
    const snippet = r.content.slice(0, 3000)
    return `### ${r.title}\nSource: ${r.url}\n\n${snippet}`
  })

  return `\n\nFetched web content:\n${parts.join('\n\n---\n\n')}`
}
