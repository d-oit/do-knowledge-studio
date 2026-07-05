import { describe, it, expect } from 'vitest';
import { __testing } from '../useChat';

const { buildStructuredContext, buildBudgetedMessages, estimateTokens } = __testing;

describe('useChat — pure functions', () => {
  describe('estimateTokens', () => {
    it('returns ceil(length / 4)', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('ab')).toBe(1);
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('abcde')).toBe(2);
    });
  });

  describe('buildStructuredContext', () => {
    it('returns empty string for empty results', () => {
      expect(buildStructuredContext([])).toBe('');
    });

    it('formats entities section', () => {
      const results = [
        { type: 'entity', title: 'Quantum', content: 'Physics topic', stage: '', score: 1 },
      ];
      const out = buildStructuredContext(results as never[]);
      expect(out).toContain('### Relevant Entities');
      expect(out).toContain('**Quantum**');
      expect(out).toContain('Physics topic');
    });

    it('formats claims section', () => {
      const results = [
        { type: 'claim', title: 'Fact X', content: 'Details here', stage: 'verified', score: 1 },
      ];
      const out = buildStructuredContext(results as never[]);
      expect(out).toContain('### Relevant Claims');
      expect(out).toContain('[verified]');
      expect(out).toContain('Details here');
    });

    it('formats notes section', () => {
      const results = [
        { type: 'note', title: 'My Note', content: 'Note body text', stage: '', score: 1 },
      ];
      const out = buildStructuredContext(results as never[]);
      expect(out).toContain('### Relevant Notes');
      expect(out).toContain('My Note');
      expect(out).toContain('Note body text');
    });

    it('combines all sections for mixed results', () => {
      const results = [
        { type: 'entity', title: 'A', content: 'a', stage: '', score: 1 },
        { type: 'claim', title: 'B', content: 'b', stage: 'draft', score: 1 },
        { type: 'note', title: 'C', content: 'c', stage: '', score: 1 },
      ];
      const out = buildStructuredContext(results as never[]);
      expect(out).toContain('### Relevant Entities');
      expect(out).toContain('### Relevant Claims');
      expect(out).toContain('### Relevant Notes');
      expect(out).toContain('Relevant local knowledge');
    });

    it('truncates long note content to 200 chars', () => {
      const longContent = 'x'.repeat(500);
      const results = [
        { type: 'note', title: 'Long', content: longContent, stage: '', score: 1 },
      ];
      const out = buildStructuredContext(results as never[]);
      expect(out).toContain('x'.repeat(200));
      expect(out).not.toContain('x'.repeat(201));
    });
  });

  describe('buildBudgetedMessages', () => {
    const sysPrompt = 'You are helpful.';
    const userMsg = 'Hello';

    it('always includes system and user messages', () => {
      const msgs = buildBudgetedMessages([], sysPrompt, userMsg, 10000);
      expect(msgs[0]).toEqual({ role: 'system', content: sysPrompt });
      expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: userMsg });
    });

    it('includes history messages within budget', () => {
      const history = [
        { id: '1', role: 'user' as const, content: 'Q1' },
        { id: '2', role: 'assistant' as const, content: 'A1' },
      ];
      const msgs = buildBudgetedMessages(history, sysPrompt, userMsg, 10000);
      expect(msgs).toHaveLength(4);
      expect(msgs[1]).toEqual({ role: 'user', content: 'Q1' });
      expect(msgs[2]).toEqual({ role: 'assistant', content: 'A1' });
    });

    it('drops oldest messages when budget exceeded', () => {
      const big = 'word '.repeat(500);
      const history = [
        { id: '1', role: 'user' as const, content: big },
        { id: '2', role: 'assistant' as const, content: big },
        { id: '3', role: 'user' as const, content: 'recent' },
      ];
      const msgs = buildBudgetedMessages(history, sysPrompt, userMsg, 500);
      expect(msgs).toHaveLength(3);
      expect(msgs[1]).toEqual({ role: 'user', content: 'recent' });
    });

    it('handles empty history', () => {
      const msgs = buildBudgetedMessages([], sysPrompt, userMsg, 100);
      expect(msgs).toHaveLength(2);
    });
  });
});
