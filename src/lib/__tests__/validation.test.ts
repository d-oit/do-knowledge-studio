import { describe, it, expect } from 'vitest';
import { EntitySchema, ClaimSchema, NoteSchema, LinkSchema } from '../validation';

describe('EntitySchema', () => {
  it('should validate a correct entity', () => {
    const entity = { name: 'Test Entity', type: 'person' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(true);
  });

  it('should validate entity with all optional fields', () => {
    const entity = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Full Entity',
      type: 'concept',
      description: 'A detailed description',
      metadata: { key: 'value', nested: { foo: 'bar' } },
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
    };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(true);
  });

  it('should fail on empty entity name', () => {
    const entity = { name: '', type: 'person' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Name is required');
    }
  });

  it('should accept whitespace-only name (zod min(1) does not trim)', () => {
    const entity = { name: '   ', type: 'person' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(true);
  });

  it('should fail on missing name', () => {
    const entity = { type: 'person' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
  });

  it('should fail on missing type', () => {
    const entity = { name: 'Test Entity' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid UUID for id', () => {
    const entity = { name: 'Test', type: 'person', id: 'not-a-uuid' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid datetime format', () => {
    const entity = { name: 'Test', type: 'person', created_at: '2024-01-15' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid metadata record', () => {
    const entity = { name: 'Test', type: 'person', metadata: 'not-an-object' };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
  });

  it('should fail on entity with null metadata', () => {
    const entity = { name: 'Test', type: 'person', metadata: null };
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(false);
  });

  it('should return inferred type', () => {
    const entity = { name: 'Test', type: 'person' };
    const result = EntitySchema.safeParse(entity);
    if (result.success) {
      expect(result.data.name).toBe('Test');
      expect(result.data.type).toBe('person');
    }
  });
});

describe('ClaimSchema', () => {
  it('should validate a correct claim', () => {
    const claim = {
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      statement: 'TRIZ is a methodology',
      confidence: 0.9,
    };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(true);
  });

  it('should validate claim with all optional fields', () => {
    const claim = {
      id: '660e8400-e29b-41d4-a716-446655440000',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      statement: 'Full claim statement',
      evidence: 'Evidence text',
      confidence: 0.75,
      source: 'Wikipedia',
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
    };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(true);
  });

  it('should fail on empty statement', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000', statement: '' };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });

  it('should fail on missing statement', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000' };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });

  it('should fail on missing entity_id', () => {
    const claim = { statement: 'Some statement' };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid entity_id UUID', () => {
    const claim = { entity_id: 'invalid-uuid', statement: 'Test' };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });

  it('should fail on confidence below 0', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000', statement: 'Test', confidence: -0.1 };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });

  it('should fail on confidence above 1', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000', statement: 'Test', confidence: 1.5 };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });

  it('should accept confidence of 0', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000', statement: 'Test', confidence: 0 };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(true);
  });

  it('should accept confidence of 1', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000', statement: 'Test', confidence: 1 };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(true);
  });

  it('should default confidence to 1', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000', statement: 'Test' };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidence).toBe(1);
    }
  });

  it('should fail on invalid datetime', () => {
    const claim = { entity_id: '550e8400-e29b-41d4-a716-446655440000', statement: 'Test', created_at: 'not-a-date' };
    const result = ClaimSchema.safeParse(claim);
    expect(result.success).toBe(false);
  });
});

describe('NoteSchema', () => {
  it('should validate a correct note', () => {
    const note = { content: 'Note content' };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(true);
  });

  it('should validate note with all fields', () => {
    const note = {
      id: '770e8400-e29b-41d4-a716-446655440000',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Full note content',
      format: 'markdown',
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
    };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(true);
  });

  it('should default format to markdown', () => {
    const note = { content: 'Test' };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('markdown');
    }
  });

  it('should accept plain format', () => {
    const note = { content: 'Test', format: 'plain' };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(true);
  });

  it('should fail on invalid format', () => {
    const note = { content: 'Test', format: 'html' };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(false);
  });

  it('should fail on empty content', () => {
    const note = { content: '' };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid entity_id', () => {
    const note = { entity_id: 'not-uuid', content: 'Test' };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid datetime', () => {
    const note = { content: 'Test', created_at: 'invalid' };
    const result = NoteSchema.safeParse(note);
    expect(result.success).toBe(false);
  });
});

describe('LinkSchema', () => {
  it('should validate a correct link', () => {
    const link = {
      source_id: '550e8400-e29b-41d4-a716-446655440000',
      target_id: '660e8400-e29b-41d4-a716-446655440000',
      relation: 'relates_to',
    };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(true);
  });

  it('should validate link with optional fields', () => {
    const link = {
      id: '880e8400-e29b-41d4-a716-446655440000',
      source_id: '550e8400-e29b-41d4-a716-446655440000',
      target_id: '660e8400-e29b-41d4-a716-446655440000',
      relation: 'depends_on',
      metadata: { weight: 1 },
      created_at: '2024-01-15T10:30:00.000Z',
      updated_at: '2024-01-15T10:30:00.000Z',
    };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(true);
  });

  it('should fail on missing source_id', () => {
    const link = { target_id: '660e8400-e29b-41d4-a716-446655440000', relation: 'test' };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });

  it('should fail on missing target_id', () => {
    const link = { source_id: '550e8400-e29b-41d4-a716-446655440000', relation: 'test' };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });

  it('should fail on missing relation', () => {
    const link = { source_id: '550e8400-e29b-41d4-a716-446655440000', target_id: '660e8400-e29b-41d4-a716-446655440000' };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });

  it('should fail on empty relation', () => {
    const link = { source_id: '550e8400-e29b-41d4-a716-446655440000', target_id: '660e8400-e29b-41d4-a716-446655440000', relation: '' };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid source_id UUID', () => {
    const link = { source_id: 'invalid', target_id: '660e8400-e29b-41d4-a716-446655440000', relation: 'test' };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid target_id UUID', () => {
    const link = { source_id: '550e8400-e29b-41d4-a716-446655440000', target_id: 'invalid', relation: 'test' };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });

  it('should fail on invalid metadata', () => {
    const link = { source_id: '550e8400-e29b-41d4-a716-446655440000', target_id: '660e8400-e29b-41d4-a716-446655440000', relation: 'test', metadata: 'string' };
    const result = LinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });
});