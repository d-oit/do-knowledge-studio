import { describe, it, expect } from 'vitest';
import { EntitySchema } from '../validation';

describe('Validation', () => {
  it('should validate a correct entity', () => {
    const entity = { name: 'Test Entity', type: 'person' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(true);
  });
});
