import { describe, it, expect } from 'vitest'
import { extractUrls, buildResearchContext, type ResearchResult } from './research'

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
})
