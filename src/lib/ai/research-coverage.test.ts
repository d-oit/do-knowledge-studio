import { describe, it, expect } from 'vitest'
import { isPrivateIP, extractUrls, buildResearchContext } from './research'
import type { ResearchResult } from './research'

describe('Research module: isPrivateIP', () => {
  it('detects localhost as private', () => {
    expect(isPrivateIP('localhost')).toBe(true)
  })

  it('detects 127.0.0.1 as private', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true)
  })

  it('detects 10.x.x.x as private', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true)
  })

  it('detects 192.168.x.x as private', () => {
    expect(isPrivateIP('192.168.1.1')).toBe(true)
  })

  it('detects 172.16.x.x as private', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true)
  })

  it('detects .local domains as private', () => {
    expect(isPrivateIP('myhost.local')).toBe(true)
  })

  it('detects .internal domains as private', () => {
    expect(isPrivateIP('myhost.internal')).toBe(true)
  })

  it('detects .onion domains as private', () => {
    expect(isPrivateIP('example.onion')).toBe(true)
  })

  it('allows public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false)
  })

  it('allows public domains', () => {
    expect(isPrivateIP('example.com')).toBe(false)
  })

  it('detects 0.0.0.0 as private', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true)
  })

  it('detects 169.254.x.x as private (link-local)', () => {
    expect(isPrivateIP('169.254.1.1')).toBe(true)
  })

  it('detects multicast IPs as private', () => {
    expect(isPrivateIP('224.0.0.1')).toBe(true)
  })

  it('detects reserved IPs as private', () => {
    expect(isPrivateIP('240.0.0.1')).toBe(true)
  })
})

describe('Research module: extractUrls', () => {
  it('extracts HTTP URLs from text', () => {
    const urls = extractUrls('Visit http://example.com for more info')
    expect(urls).toContain('http://example.com')
  })

  it('extracts HTTPS URLs from text', () => {
    const urls = extractUrls('Visit https://example.com for more info')
    expect(urls).toContain('https://example.com')
  })

  it('deduplicates URLs', () => {
    const urls = extractUrls('Visit https://example.com and https://example.com again')
    expect(urls.filter((u) => u === 'https://example.com')).toHaveLength(1)
  })

  it('filters out private IPs', () => {
    const urls = extractUrls('Visit http://192.168.1.1/admin')
    expect(urls).toHaveLength(0)
  })

  it('filters out localhost', () => {
    const urls = extractUrls('Visit http://localhost:3000')
    expect(urls).toHaveLength(0)
  })

  it('returns empty array for text without URLs', () => {
    const urls = extractUrls('No URLs here')
    expect(urls).toEqual([])
  })

  it('filters out non-http protocols', () => {
    const urls = extractUrls('Send mailto:user@example.com')
    expect(urls).toHaveLength(0)
  })
})

describe('Research module: buildResearchContext', () => {
  it('returns empty string for no successful results', () => {
    const results: ResearchResult[] = [
      { url: 'https://example.com', title: '', content: '', success: false, error: 'Failed' },
    ]
    expect(buildResearchContext(results)).toBe('')
  })

  it('builds context from successful results', () => {
    const results: ResearchResult[] = [
      { url: 'https://example.com', title: 'Example', content: 'Content here', success: true },
    ]
    const ctx = buildResearchContext(results)
    expect(ctx).toContain('Fetched web content')
    expect(ctx).toContain('Example')
    expect(ctx).toContain('https://example.com')
  })

  it('truncates long content to 3000 chars', () => {
    const longContent = 'x'.repeat(5000)
    const results: ResearchResult[] = [
      { url: 'https://example.com', title: 'Long', content: longContent, success: true },
    ]
    const ctx = buildResearchContext(results)
    // The content in context should be truncated to 3000 chars
    expect(ctx.length).toBeLessThan(5200)
  })

  it('handles mixed success and failure results', () => {
    const results: ResearchResult[] = [
      { url: 'https://fail.com', title: '', content: '', success: false },
      { url: 'https://success.com', title: 'Success', content: 'OK', success: true },
    ]
    const ctx = buildResearchContext(results)
    expect(ctx).toContain('Success')
    expect(ctx).not.toContain('fail.com')
  })
})
