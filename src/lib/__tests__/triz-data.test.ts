import { describe, it, expect } from 'vitest';
import { ENGINEERING_PARAMETERS, INVENTIVE_PRINCIPLES, getContradictionPrinciples, getPrincipleByNumber } from '../triz-data';

describe('triz-data', () => {
  describe('ENGINEERING_PARAMETERS', () => {
    it('has 39 parameters', () => {
      expect(ENGINEERING_PARAMETERS).toHaveLength(39);
    });

    it('contains known parameters', () => {
      expect(ENGINEERING_PARAMETERS).toContain('Speed');
      expect(ENGINEERING_PARAMETERS).toContain('Force');
      expect(ENGINEERING_PARAMETERS).toContain('Weight of Moving Object');
    });
  });

  describe('INVENTIVE_PRINCIPLES', () => {
    it('has 40 principles', () => {
      expect(INVENTIVE_PRINCIPLES).toHaveLength(40);
    });

    it('each principle has number, name, description, and examples', () => {
      for (const p of INVENTIVE_PRINCIPLES) {
        expect(p.number).toBeGreaterThan(0);
        expect(p.number).toBeLessThanOrEqual(40);
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.description.length).toBeGreaterThan(0);
        expect(p.examples.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getContradictionPrinciples', () => {
    it('returns principles for known contradictions', () => {
      const principles = getContradictionPrinciples(0, 1); // Weight vs Weight
      expect(principles.length).toBeGreaterThan(0);
      expect(principles.every(n => n >= 1 && n <= 40)).toBe(true);
    });

    it('returns default principles for unknown contradictions', () => {
      const principles = getContradictionPrinciples(38, 38);
      expect(principles).toEqual([1, 10, 35, 28]);
    });
  });

  describe('getPrincipleByNumber', () => {
    it('returns principle by number', () => {
      const p = getPrincipleByNumber(1);
      expect(p?.name).toBe('Segmentation');
    });

    it('returns undefined for invalid number', () => {
      expect(getPrincipleByNumber(99)).toBeUndefined();
    });
  });
});
