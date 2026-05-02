import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../security';

describe('security utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS & attack")</script>\'';
      const expected = '&lt;script&gt;alert(&quot;XSS &amp; attack&quot;)&lt;/script&gt;&#039;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle strings without special characters', () => {
      const input = 'Hello World 123';
      expect(escapeHtml(input)).toBe(input);
    });

    it('should escape repeated characters', () => {
      const input = '<<<<';
      const expected = '&lt;&lt;&lt;&lt;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });
});
