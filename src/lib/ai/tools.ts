/**
 * Structured tool definitions for client-side LLM pull-based retrieval
 * (TRIZ Principle #13 Inversion & #1 Segmentation).
 */

import type { Entity, Claim } from '@/lib/studio/types'
import { search } from '@/lib/search/retrieval'
import { buildEntityIndex, buildAdjacencyIndex } from '@/lib/studio/graph-index'

/** JSON schema description for an LLM tool parameter property. */
export interface ToolPropertySchema {
  type: string
  description: string
  enum?: string[]
}

/** Definition for a tool callable by the AI model. */
export interface AiToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, ToolPropertySchema>
      required: string[]
    }
  }
}

/** Standard tool set exposed to AI providers supporting function calling. */
export const STUDIO_AI_TOOLS: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_library',
      description: 'Search the local knowledge base entities and claims using BM25 relevance scoring.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or keywords to match against entities and claims.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_entity_claims',
      description: 'Retrieve verified claims and evidence supporting a specific entity in the knowledge base.',
      parameters: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: 'The unique ID of the target entity.',
          },
        },
        required: ['entityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_graph_neighborhood',
      description: 'Retrieve direct connected neighbor entities for a given entity in the knowledge graph.',
      parameters: {
        type: 'object',
        properties: {
          entityId: {
            type: 'string',
            description: 'The unique ID of the target entity.',
          },
        },
        required: ['entityId'],
      },
    },
  },
]

/** Execute a library tool call locally against the studio state. */
export const executeStudioTool = (
  name: string,
  args: Record<string, unknown>,
  entities: Entity[],
  claims: Claim[],
): { success: boolean; data?: unknown; error?: string } => {
  try {
    switch (name) {
      case 'search_library': {
        const query = typeof args.query === 'string' ? args.query : ''
        const limit = typeof args.limit === 'number' ? args.limit : 5
        const results = search(entities, claims, query, limit)
        return { success: true, data: results }
      }
      case 'get_entity_claims': {
        const entityId = typeof args.entityId === 'string' ? args.entityId : ''
        const entityClaims = claims.filter((c) => c.entityId === entityId)
        return { success: true, data: entityClaims }
      }
      case 'get_graph_neighborhood': {
        const entityId = typeof args.entityId === 'string' ? args.entityId : ''
        const adjacency = buildAdjacencyIndex(entities)
        const neighborIds = Array.from(adjacency.get(entityId) ?? [])
        const entityIndex = buildEntityIndex(entities)
        const neighbors = neighborIds
          .map((id) => entityIndex.get(id))
          .filter((e): e is Entity => Boolean(e))
          .map((e) => ({ id: e.id, name: e.name, type: e.type, tags: e.tags }))
        return { success: true, data: neighbors }
      }
      default:
        return { success: false, error: `Unknown tool: ${name}` }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown tool execution error',
    }
  }
}
