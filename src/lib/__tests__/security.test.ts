import { describe, it, expect } from 'vitest';
import { sanitizeHtml, escapeHtml } from '../security';

describe('sanitizeHtml', () => {
  it('neutralizes script tags', () => {
    const result = sanitizeHtml('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert(1)');
  });

  it('neutralizes event handlers', () => {
    const result = sanitizeHtml('<img onerror="alert(1)" src=x>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert(1)');
  });

  it('neutralizes javascript: URLs', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('preserves safe HTML tags', () => {
    const result = sanitizeHtml('<strong>bold</strong>');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('preserves italic tags', () => {
    const result = sanitizeHtml('<em>italic</em>');
    expect(result).toContain('<em>italic</em>');
  });

  it('preserves lists', () => {
    const result = sanitizeHtml('<ul><li>item</li></ul>');
    expect(result).toContain('<ul><li>item</li></ul>');
  });

  it('preserves headings', () => {
    const result = sanitizeHtml('<h2>heading</h2>');
    expect(result).toContain('<h2>heading</h2>');
  });

  it('strips disallowed tags', () => {
    const result = sanitizeHtml('<style>body{color:red}</style>');
    expect(result).not.toContain('<style>');
  });
});

describe('escapeHtml', () => {
  it('encodes ampersand', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('encodes less than', () => {
    expect(escapeHtml('a<b')).toBe('a&lt;b');
  });

  it('encodes greater than', () => {
    expect(escapeHtml('a>b')).toBe('a&gt;b');
  });

  it('encodes double quote', () => {
    expect(escapeHtml('a"b')).toBe('a&quot;b');
  });

  it('encodes single quote', () => {
    expect(escapeHtml("a'b")).toBe('a&#x27;b');
  });

  it('encodes all special chars', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#x27;');
  });

  it('passes through safe text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});
