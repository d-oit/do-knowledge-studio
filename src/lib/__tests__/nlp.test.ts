import { describe, it, expect } from 'vitest';
import { stripHtml, removeStopWords, compressText } from '../nlp';

describe('NLP Utilities', () => {
  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stripHtml('<p>Hello <b>World</b></p>').trim().replace(/\s+/g, ' ')).toBe('Hello World');
    });
  });

  describe('removeStopWords', () => {
    it('should remove common English stop words', () => {
      const input = 'This is a test of the emergency broadcast system';
      const output = removeStopWords(input);
      const words = output.toLowerCase().split(' ');

      expect(words).not.toContain('this');
      expect(words).not.toContain('is');
      expect(words).not.toContain('a');
      expect(words).not.toContain('of');
      expect(words).not.toContain('the');
      expect(output).toBe('test emergency broadcast system');
    });
  });

  describe('compressText', () => {
    it('should strip HTML and stop words', () => {
      const input = '<p>The <b>TRIZ</b> method is a <i>problem solving</i> framework.</p>';
      const output = compressText(input);
      expect(output).toBe('TRIZ method problem solving framework.');
    });

    it('should trim to maxLength and add ellipsis', () => {
      const input = 'This is a very long sentence that should definitely be trimmed because it exceeds the maximum length limit we have set for the search index excerpt field to save memory.';
      const output = compressText(input, 30);
      expect(output.length).toBeLessThanOrEqual(33); // 30 + 3 for '...'
      expect(output).toContain('...');
    });
  });
});
