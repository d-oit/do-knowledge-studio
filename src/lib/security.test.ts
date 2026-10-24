import { describe, it, expect } from 'vitest'
import { escapeHtml, sanitizeUrl } from './security'

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('handles string with no special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('escapes multiple special characters in one string', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    )
  })
})

describe('sanitizeUrl', () => {
  it('allows http and https URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com')
    expect(sanitizeUrl('https://example.com/path?query=1#hash')).toBe(
      'https://example.com/path?query=1#hash',
    )
  })

  it('allows mailto and tel URLs by default', () => {
    expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com')
    expect(sanitizeUrl('tel:+1234567890')).toBe('tel:+1234567890')
  })

  it('allows safe relative path URLs', () => {
    expect(sanitizeUrl('/dashboard')).toBe('/dashboard')
    expect(sanitizeUrl('/docs/setup?v=1')).toBe('/docs/setup?v=1')
  })

  it('blocks protocol-relative URLs and backslash bypasses', () => {
    expect(sanitizeUrl('//evil.com')).toBe('')
    expect(sanitizeUrl('//evil.com/phishing')).toBe('')
    expect(sanitizeUrl('/\\evil.com')).toBe('')
    expect(sanitizeUrl('/\\evil.com/phishing')).toBe('')
    // Backslashes in absolute URLs are normalized to slashes by browsers, so
    // they must never pass through (https:/\\evil.com resolves to https://evil.com).
    expect(sanitizeUrl('https:/\\evil.com')).toBe('')
    expect(sanitizeUrl('https:\\evil.com')).toBe('')
    expect(sanitizeUrl('http:\\example.com\\@evil.com')).toBe('')
  })

  it('blocks dangerous schemes (javascript, data, vbscript)', () => {
    const scriptPayload = ['java', 'script:', 'alert(1)'].join('')
    expect(sanitizeUrl(scriptPayload)).toBe('')
    expect(sanitizeUrl(scriptPayload.toUpperCase())).toBe('')
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('')
  })

  it('blocks malformed and non-string inputs', () => {
    expect(sanitizeUrl('')).toBe('')
    expect(sanitizeUrl('   ')).toBe('')
    expect(sanitizeUrl('not a url')).toBe('')
    expect(sanitizeUrl(null as unknown as string)).toBe('')
    expect(sanitizeUrl(undefined as unknown as string)).toBe('')
  })

  it('supports custom allowed protocols', () => {
    expect(sanitizeUrl('ftp://files.example.com', ['ftp'])).toBe('ftp://files.example.com')
    expect(sanitizeUrl('https://example.com', ['ftp'])).toBe('')
  })

  it('restricts image source protocols when explicit http/https allowlist is passed', () => {
    const imageProtocols = ['http:', 'https:']
    expect(sanitizeUrl('https://example.com/image.png', imageProtocols)).toBe('https://example.com/image.png')
    expect(sanitizeUrl('http://example.com/image.png', imageProtocols)).toBe('http://example.com/image.png')
    expect(sanitizeUrl('mailto:user@example.com', imageProtocols)).toBe('')
    expect(sanitizeUrl('tel:+1234567890', imageProtocols)).toBe('')
  })

  it('strips ASCII control characters and neutralizes obfuscated scheme payloads', () => {
    expect(sanitizeUrl('/dashboard\x00path')).toBe('/dashboardpath')
    expect(sanitizeUrl('/docs\x09setup')).toBe('/docssetup')
    expect(sanitizeUrl('https://example.com/path\x0D\x0Awith-crlf')).toBe(
      'https://example.com/pathwith-crlf',
    )
    expect(sanitizeUrl('java\x00script:alert(1)')).toBe('')
    expect(sanitizeUrl('java\x09script:alert(1)')).toBe('')
    expect(sanitizeUrl('java\x0Ascript:alert(1)')).toBe('')
    expect(sanitizeUrl('java\x0Dscript:alert(1)')).toBe('')
    expect(sanitizeUrl('java\x1Fscript:alert(1)')).toBe('')
    expect(sanitizeUrl('java\x7Fscript:alert(1)')).toBe('')
  })
})
