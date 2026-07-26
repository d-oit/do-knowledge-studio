import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractUrls, buildResearchContext, isPrivateIP, fetchUrlContent, fetchUrls, type ResearchResult } from './research'

describe('isPrivateIP', () => {
  it('returns true for localhost', () => {
    expect(isPrivateIP('localhost')).toBe(true)
  })

  it('returns true for .local domains', () => {
    expect(isPrivateIP('myhost.local')).toBe(true)
    expect(isPrivateIP('device.local.')).toBe(true)
  })

  it('returns true for .internal domains', () => {
    expect(isPrivateIP('server.internal')).toBe(true)
  })

  it('returns true for .localhost domains', () => {
    expect(isPrivateIP('sub.localhost')).toBe(true)
  })

  it('returns true for .lan domains', () => {
    expect(isPrivateIP('myhost.lan')).toBe(true)
  })

  it('returns true for .test domains', () => {
    expect(isPrivateIP('test.example.test')).toBe(true)
  })

  it('returns true for .invalid domains', () => {
    expect(isPrivateIP('invalid.example.invalid')).toBe(true)
  })

  it('returns true for .example domains', () => {
    expect(isPrivateIP('example.com.example')).toBe(true)
  })

  it('returns true for .onion domains', () => {
    expect(isPrivateIP('abc123.onion')).toBe(true)
  })

  it('returns true for private IPv4 addresses', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true)
    expect(isPrivateIP('172.16.0.1')).toBe(true)
    expect(isPrivateIP('192.168.1.1')).toBe(true)
    expect(isPrivateIP('127.0.0.1')).toBe(true)
    expect(isPrivateIP('0.0.0.0')).toBe(true)
  })

  it('returns true for link-local IPv4', () => {
    expect(isPrivateIP('169.254.1.1')).toBe(true)
  })

  it('returns true for carrier-grade NAT', () => {
    expect(isPrivateIP('100.64.0.1')).toBe(true)
  })

  it('returns true for multicast addresses', () => {
    expect(isPrivateIP('224.0.0.1')).toBe(true)
    expect(isPrivateIP('239.255.255.255')).toBe(true)
  })

  it('returns true for reserved addresses', () => {
    expect(isPrivateIP('240.0.0.1')).toBe(true)
  })

  it('returns true for IANA special addresses', () => {
    expect(isPrivateIP('192.0.0.1')).toBe(true)
    expect(isPrivateIP('192.0.2.1')).toBe(true)
    expect(isPrivateIP('198.51.100.1')).toBe(true)
    expect(isPrivateIP('203.0.113.1')).toBe(true)
  })

  it('returns true for loopback IPv6', () => {
    expect(isPrivateIP('::1')).toBe(true)
    expect(isPrivateIP('::')).toBe(true)
  })

  it('returns true for IPv6 link-local', () => {
    expect(isPrivateIP('fe80::1')).toBe(true)
  })

  it('returns true for IPv6 ULA', () => {
    expect(isPrivateIP('fd00::1')).toBe(true)
    expect(isPrivateIP('fc00::1')).toBe(true)
  })

  it('returns true for IPv6 multicast', () => {
    expect(isPrivateIP('ff02::1')).toBe(true)
  })

  it('returns true for IPv4-mapped IPv6', () => {
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true)
  })

  it('returns true for bare labels without dots or colons', () => {
    expect(isPrivateIP('hostname')).toBe(true)
  })

  it('returns false for public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false)
    expect(isPrivateIP('1.1.1.1')).toBe(false)
  })

  it('returns false for public hostnames', () => {
    expect(isPrivateIP('example.com')).toBe(false)
    expect(isPrivateIP('google.com')).toBe(false)
  })

  it('returns false for public IPv6', () => {
    expect(isPrivateIP('2001:db8::1')).toBe(false)
  })

  it('handles bracketed IPv6 addresses', () => {
    expect(isPrivateIP('[::1]')).toBe(true)
    expect(isPrivateIP('[2001:db8::1]')).toBe(false)
  })

  it('handles trailing dot', () => {
    expect(isPrivateIP('localhost.')).toBe(true)
    expect(isPrivateIP('example.com.')).toBe(false)
  })
})

describe('extractUrls', () => {
  it('extracts URLs from text', () => {
    const urls = extractUrls('Check https://example.com and http://test.org/page')
    expect(urls).toEqual(['https://example.com', 'http://test.org/page'])
  })

  it('deduplicates URLs', () => {
    const urls = extractUrls('Visit https://example.com twice https://example.com')
    expect(urls).toEqual(['https://example.com'])
  })

  it('returns empty array for no URLs', () => {
    expect(extractUrls('no urls here')).toEqual([])
  })

  it('ignores invalid URLs', () => {
    const urls = extractUrls('not a url and https://valid.com')
    expect(urls).toEqual(['https://valid.com'])
  })

  it('filters out private IPs', () => {
    const urls = extractUrls('http://localhost:3000 and https://example.com')
    expect(urls).toEqual(['https://example.com'])
  })

  it('filters out private hostnames', () => {
    const urls = extractUrls('http://192.168.1.1 and https://example.com')
    expect(urls).toEqual(['https://example.com'])
  })

  it('handles multiple URLs', () => {
    const urls = extractUrls('Visit https://a.com and https://b.com and https://c.com')
    expect(urls).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
  })
})

describe('buildResearchContext', () => {
  it('returns empty string for no successful results', () => {
    const results: ResearchResult[] = [
      { url: 'https://fail.com', title: '', content: '', success: false, error: 'failed' },
    ]
    expect(buildResearchContext(results)).toBe('')
  })

  it('builds context from successful results', () => {
    const results: ResearchResult[] = [
      { url: 'https://example.com', title: 'Example', content: 'Page content', success: true },
    ]
    const ctx = buildResearchContext(results)
    expect(ctx).toContain('Example')
    expect(ctx).toContain('https://example.com')
    expect(ctx).toContain('Page content')
  })

  it('truncates long content in snippet', () => {
    const longContent = 'x'.repeat(5000)
    const results: ResearchResult[] = [
      { url: 'https://example.com', title: 'Test', content: longContent, success: true },
    ]
    const ctx = buildResearchContext(results)
    expect(ctx).toContain('Test')
    expect(ctx).toContain('https://example.com')
  })

  it('combines multiple successful results', () => {
    const results: ResearchResult[] = [
      { url: 'https://a.com', title: 'A', content: 'Content A', success: true },
      { url: 'https://b.com', title: 'B', content: 'Content B', success: true },
    ]
    const ctx = buildResearchContext(results)
    expect(ctx).toContain('A')
    expect(ctx).toContain('B')
    expect(ctx).toContain('Content A')
    expect(ctx).toContain('Content B')
  })

  it('uses hostname as title fallback', () => {
    const results: ResearchResult[] = [
      { url: 'https://example.com/page', title: '', content: 'Content', success: true },
    ]
    const ctx = buildResearchContext(results)
    expect(ctx).toContain('example.com')
  })
})

describe('fetchUrlContent', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches URL content successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '# Title\n\nContent here',
    } as Response)

    const result = await fetchUrlContent('https://example.com')
    expect(result.success).toBe(true)
    expect(result.title).toBe('Title')
    expect(result.content).toContain('Content here')
  })

  it('blocks private IPs', async () => {
    const result = await fetchUrlContent('http://localhost:3000')
    expect(result.success).toBe(false)
    expect(result.error).toContain('private/reserved')
  })

  it('blocks non-http protocols', async () => {
    const result = await fetchUrlContent('ftp://example.com')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Blocked URL scheme')
  })

  it('handles fetch errors', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchUrlContent('https://example.com')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('handles non-OK responses', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    const result = await fetchUrlContent('https://example.com')
    expect(result.success).toBe(false)
    expect(result.error).toContain('404')
  })

  it('uses hostname as title fallback when no title', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => 'No title here',
    } as Response)

    const result = await fetchUrlContent('https://example.com/page')
    expect(result.success).toBe(true)
    expect(result.title).toBe('example.com')
  })

  it('truncates long content', async () => {
    const longContent = 'x'.repeat(10000)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => longContent,
    } as Response)

    const result = await fetchUrlContent('https://example.com')
    expect(result.success).toBe(true)
    expect(result.content.length).toBeLessThan(10000)
    expect(result.content).toContain('[Content truncated]')
  })
})

describe('fetchUrls', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches multiple URLs in parallel', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# Page 1\nContent 1',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# Page 2\nContent 2',
      } as Response)

    const results = await fetchUrls(['https://a.com', 'https://b.com'])
    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(true)
  })

  it('handles mix of success and failure', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# Success',
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

    const results = await fetchUrls(['https://a.com', 'https://b.com'])
    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(false)
  })
})
