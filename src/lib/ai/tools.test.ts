import { describe, it, expect } from 'vitest'
import { STUDIO_AI_TOOLS, executeStudioTool } from './tools'
import { buildSystemPrompt, buildMessages } from './context'
import type { Entity, Claim } from '@/lib/studio/types'

const sampleEntities: Entity[] = [
  {
    id: 'ent-a',
    name: 'TRIZ Inventive Method',
    type: 'concept',
    description: 'Systematic innovation principles',
    content: 'Contradiction matrix and separation principles',
    tags: ['triz', 'engineering'],
    created: '2026-09-01T00:00:00.000Z',
    updated: '2026-09-01T00:00:00.000Z',
    links: [{ targetId: 'ent-b', relation: 'relates to' }],
  },
  {
    id: 'ent-b',
    name: 'Altshuller Matrix',
    type: 'note',
    description: 'Table of 39 parameters and 40 principles',
    content: 'Mapped parameters and inventive principles',
    tags: ['matrix'],
    created: '2026-09-01T00:00:00.000Z',
    updated: '2026-09-01T00:00:00.000Z',
    links: [],
  },
]

const sampleClaims: Claim[] = [
  {
    id: 'clm-1',
    entityId: 'ent-a',
    statement: 'Technical contradictions can be resolved without compromise.',
    confidence: 'confirmed',
    created: '2026-09-01T00:00:00.000Z',
  },
]

describe('AI Tools Module', () => {
  it('exposes defined STUDIO_AI_TOOLS schemas', () => {
    expect(STUDIO_AI_TOOLS.length).toBe(3)
    const toolNames = STUDIO_AI_TOOLS.map((t) => t.function.name)
    expect(toolNames).toContain('search_library')
    expect(toolNames).toContain('get_entity_claims')
    expect(toolNames).toContain('get_graph_neighborhood')
  })

  it('executes search_library tool successfully', () => {
    const res = executeStudioTool(
      'search_library',
      { query: 'Altshuller', limit: 3 },
      sampleEntities,
      sampleClaims,
    )
    expect(res.success).toBe(true)
    const data = res.data as { name: string }[]
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].name).toContain('Altshuller')
  })

  it('executes get_entity_claims tool successfully', () => {
    const res = executeStudioTool(
      'get_entity_claims',
      { entityId: 'ent-a' },
      sampleEntities,
      sampleClaims,
    )
    expect(res.success).toBe(true)
    const data = res.data as Claim[]
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('clm-1')
  })

  it('executes get_graph_neighborhood tool successfully', () => {
    const res = executeStudioTool(
      'get_graph_neighborhood',
      { entityId: 'ent-a' },
      sampleEntities,
      sampleClaims,
    )
    expect(res.success).toBe(true)
    const data = res.data as { id: string; name: string }[]
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('ent-b')
  })

  it('handles unknown tools gracefully', () => {
    const res = executeStudioTool('nonexistent_tool', {}, sampleEntities, sampleClaims)
    expect(res.success).toBe(false)
    expect(res.error).toContain('Unknown tool')
  })
})

describe('AI Context Budget Options', () => {
  it('respects maxResults and maxSnippetLength options', () => {
    const prompt = buildSystemPrompt(
      'TRIZ',
      sampleEntities,
      sampleClaims,
      true,
      undefined,
      { maxResults: 1, maxSnippetLength: 10 },
    )
    expect(prompt).toContain('Relevant entities')
    expect(prompt).toContain('TRIZ')
  })

  it('builds full message array with budget options', () => {
    const messages = buildMessages(
      [],
      'Explain TRIZ',
      sampleEntities,
      sampleClaims,
      true,
      undefined,
      { maxResults: 2 },
    )
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
  })
})
