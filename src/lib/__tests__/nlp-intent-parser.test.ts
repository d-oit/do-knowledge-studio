import { describe, it, expect } from 'vitest';
import { parseVoiceInput } from '../nlp-intent-parser';

describe('nlp-intent-parser', () => {
  describe('parseVoiceInput', () => {
    it('returns empty result for empty input', () => {
      const result = parseVoiceInput('');
      expect(result.entities).toEqual([]);
      expect(result.claims).toEqual([]);
      expect(result.relations).toEqual([]);
    });

    it('extracts entities from "X is a Y" pattern', () => {
      const result = parseVoiceInput('React is a JavaScript UI library');
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('extracts entities from "create entity" pattern', () => {
      const result = parseVoiceInput('create entity called Machine Learning of type tech');
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.entities[0].name).toContain('Machine Learning');
    });

    it('extracts claims from "X is Y" pattern', () => {
      const result = parseVoiceInput('Python is a programming language');
      expect(result.claims.length).toBeGreaterThan(0);
    });

    it('extracts relations from "X relates to Y" pattern', () => {
      const result = parseVoiceInput('React relates to JavaScript');
      expect(result.relations.length).toBeGreaterThan(0);
      expect(result.relations[0].source).toContain('React');
      expect(result.relations[0].target).toContain('JavaScript');
    });

    it('detects contradiction relations', () => {
      const result = parseVoiceInput('Python contradicts Java');
      expect(result.relations.length).toBeGreaterThan(0);
      expect(result.relations[0].relation).toBe('contradicts');
    });

    it('handles multiple sentences', () => {
      const result = parseVoiceInput('React is a library. Vue is a framework. React relates to Vue.');
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.relations.length).toBeGreaterThan(0);
    });

    it('preserves raw text', () => {
      const text = 'This is a test sentence.';
      const result = parseVoiceInput(text);
      expect(result.rawText).toBe(text);
    });

    it('deduplicates entities', () => {
      const result = parseVoiceInput('React is a library. React is a framework.');
      const names = result.entities.map(e => e.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
