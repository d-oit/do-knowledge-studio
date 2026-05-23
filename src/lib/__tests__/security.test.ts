import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../security';

describe('escapeHtml', () => {
  it('escapes basic HTML characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('Me & You')).toBe('Me &amp; You');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("It's a trap")).toBe('It&#039;s a trap');
  });

  it('handles strings with no special characters', () => {
    expect(escapeHtml('Normal string')).toBe('Normal string');
  });

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes multiple occurrences of characters', () => {
    expect(escapeHtml('<<< & " \' >>>'))
      .toBe('&lt;&lt;&lt; &amp; &quot; &#039; &gt;&gt;&gt;');
  });
});
