import { describe, it, expect } from 'vitest'
import { escapeHtml, sanitizeHtml, sanitizeText, sanitizeUrl } from './security'

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

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('')
  })

  it('allows safe formatting tags', () => {
    const result = sanitizeHtml('<p>Hello <strong>world</strong></p>')
    expect(result).toContain('<p>')
    expect(result).toContain('<strong>')
  })

  it('strips event handlers', () => {
    expect(sanitizeHtml('<img src=x onerror=alert(1)>')).not.toContain('onerror')
  })

  it('allows links', () => {
    const result = sanitizeHtml('<a href="https://example.com">click</a>')
    expect(result).toContain('<a href="https://example.com">')
  })

  it('strips javascript: URLs from links', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('strips javascript: URLs from img src', () => {
    const result = sanitizeHtml('<img src="javascript:alert(1)">')
    expect(result).not.toContain('javascript:')
  })
})

describe('sanitizeText', () => {
  it('strips all HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold')
  })

  it('handles plain text', () => {
    expect(sanitizeText('hello world')).toBe('hello world')
  })

  it('strips script injection', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('')
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
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('')
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
})
