import { describe, it, expect } from 'vitest'
import { escapeHtml, sanitizeHtml, sanitizeText } from './security'

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
