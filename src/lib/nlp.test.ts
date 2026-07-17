import { describe, it, expect } from 'vitest'
import { parseIntent, formatIntentSummary } from './nlp'

describe('parseIntent', () => {
  describe('create_entity', () => {
    it('parses note creation', () => {
      const result = parseIntent('Create a note about TypeScript generics')
      expect(result.type).toBe('create_entity')
      if (result.type === 'create_entity') {
        expect(result.entityType).toBe('note')
        expect(result.name).toContain('TypeScript generics')
      }
    })

    it('parses concept creation', () => {
      const result = parseIntent('Add a concept called dependency injection')
      expect(result.type).toBe('create_entity')
      if (result.type === 'create_entity') {
        expect(result.entityType).toBe('concept')
        expect(result.name).toContain('dependency injection')
      }
    })

    it('parses person creation', () => {
      const result = parseIntent('Note person Martin Kleppmann')
      expect(result.type).toBe('create_entity')
      if (result.type === 'create_entity') {
        expect(result.entityType).toBe('person')
      }
    })

    it('parses project creation', () => {
      const result = parseIntent('New project knowledge studio')
      expect(result.type).toBe('create_entity')
      if (result.type === 'create_entity') {
        expect(result.entityType).toBe('project')
      }
    })

    it('extracts tags', () => {
      const result = parseIntent('Create note about React hooks tags: frontend, javascript')
      expect(result.type).toBe('create_entity')
      if (result.type === 'create_entity') {
        expect(result.tags).toContain('frontend')
        expect(result.tags).toContain('javascript')
      }
    })

    it('extracts hashtags', () => {
      const result = parseIntent('Note about #react #hooks performance')
      expect(result.type).toBe('create_entity')
      if (result.type === 'create_entity') {
        expect(result.tags).toContain('react')
        expect(result.tags).toContain('hooks')
      }
    })
  })

  describe('add_claim', () => {
    it('parses claim creation', () => {
      const result = parseIntent('Claim that TypeScript is better than JavaScript')
      expect(result.type).toBe('add_claim')
      if (result.type === 'add_claim') {
        expect(result.statement).toContain('TypeScript is better than JavaScript')
      }
    })

    it('parses fact statement', () => {
      const result = parseIntent('Fact: React was created by Facebook')
      expect(result.type).toBe('add_claim')
      if (result.type === 'add_claim') {
        expect(result.statement).toContain('React was created by Facebook')
      }
    })
  })

  describe('search', () => {
    it('parses search query', () => {
      const result = parseIntent('Search for TypeScript')
      expect(result.type).toBe('search')
      if (result.type === 'search') {
        expect(result.query).toBe('TypeScript')
      }
    })

    it('parses find query', () => {
      const result = parseIntent('Find all notes about React')
      expect(result.type).toBe('search')
      if (result.type === 'search') {
        expect(result.query).toContain('React')
      }
    })

    it('parses show me query', () => {
      const result = parseIntent('Show me projects')
      expect(result.type).toBe('search')
    })
  })

  describe('unknown', () => {
    it('returns unknown for empty input', () => {
      const result = parseIntent('')
      expect(result.type).toBe('unknown')
    })

    it('returns unknown for gibberish', () => {
      const result = parseIntent('asdfghjkl')
      expect(result.type).toBe('unknown')
    })
  })
})

describe('formatIntentSummary', () => {
  it('formats create_entity', () => {
    const summary = formatIntentSummary({
      type: 'create_entity',
      name: 'React Hooks',
      entityType: 'concept',
      description: '',
      tags: [],
    })
    expect(summary).toBe('Create concept: "React Hooks"')
  })

  it('formats add_claim', () => {
    const summary = formatIntentSummary({
      type: 'add_claim',
      statement: 'TypeScript is better than JavaScript for large projects',
      confidence: 0.8,
    })
    expect(summary).toContain('Add claim:')
    expect(summary).toContain('TypeScript')
  })

  it('formats search', () => {
    const summary = formatIntentSummary({
      type: 'search',
      query: 'React hooks',
    })
    expect(summary).toBe('Search: "React hooks"')
  })

  it('formats unknown', () => {
    const summary = formatIntentSummary({
      type: 'unknown',
      raw: 'random text',
    })
    expect(summary).toContain('Unrecognized:')
  })
})
