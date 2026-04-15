import { describe, it, expect } from 'vitest';
import { EntitySchema, ClaimSchema } from '../validation';

describe('Validation', () => {
  it('should validate a correct entity', () => {
    const entity = { name: 'Test Entity', type: 'person' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(true);
  });

  it('should fail on empty entity name', () => {
    const entity = { name: '', type: 'person' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
  });

  it('should validate a correct claim', () => {
    const claim = {
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      statement: 'TRIZ is a methodology',
      confidence: 0.9
    };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(true);
  });
});
