/**
 * Structured tool definitions for client-side LLM pull-based retrieval
 * (TRIZ Principle #13 Inversion & #1 Segmentation).
 */

import { z } from 'zod'
import type { Entity, Claim } from '@/lib/studio/types'
import type { ResearchResult } from './research'
import { search } from '@/lib/search/retrieval'
import { buildEntityIndex, buildAdjacencyIndex } from '@/lib/studio/graph-index'

/** Maximum allowed JSON argument payload size in bytes (10KB). */
export const MAX_ARG_PAYLOAD_BYTES = 10_000
/** Maximum character length for string parameters. */
export const MAX_STRING_PARAM_LENGTH = 500
/** Maximum result items returned per tool execution. */
export const MAX_TOOL_RESULTS_LIMIT = 50

/** Zod schema for search_library argument validation. */
export const SearchLibrarySchema = z.object({
  query: z.string().min(1).max(MAX_STRING_PARAM_LENGTH),
  limit: z.number().int().min(1).max(MAX_TOOL_RESULTS_LIMIT).optional().default(5),
})

/** Zod schema for get_entity_claims argument validation. */
export const GetEntityClaimsSchema = z.object({
  entityId: z.string().min(1).max(MAX_STRING_PARAM_LENGTH),
})

/** Zod schema for get_graph_neighborhood argument validation. */
export const GetGraphNeighborhoodSchema = z.object({
  entityId: z.string().min(1).max(MAX_STRING_PARAM_LENGTH),
})

export interface ToolExecutionOptions {
  /** Explicit opt-in required for executing mutating tools. */
  allowWrite?: boolean
}

/** Known tool capabilities and mutation permissions. */
const KNOWN_TOOLS: Record<string, { isMutating: boolean }> = {
  search_library: { isMutating: false },
  get_entity_claims: { isMutating: false },
  get_graph_neighborhood: { isMutating: false },
}

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

const dispatchTool = (
  name: string,
  args: Record<string, unknown>,
  entities: Entity[],
  claims: Claim[],
): { success: boolean; data?: unknown; error?: string } => {
  switch (name) {
    case 'search_library': {
      const parsed = SearchLibrarySchema.safeParse(args)
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid search_library arguments: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        }
      }
      const limit = Math.min(parsed.data.limit, MAX_TOOL_RESULTS_LIMIT)
      const results = search(entities, claims, parsed.data.query, limit)
      return { success: true, data: results.slice(0, MAX_TOOL_RESULTS_LIMIT) }
    }
    case 'get_entity_claims': {
      const parsed = GetEntityClaimsSchema.safeParse(args)
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid get_entity_claims arguments: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        }
      }
      const matched = claims.filter((c) => c.entityId === parsed.data.entityId)
      return { success: true, data: matched.slice(0, MAX_TOOL_RESULTS_LIMIT) }
    }
    case 'get_graph_neighborhood': {
      const parsed = GetGraphNeighborhoodSchema.safeParse(args)
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid get_graph_neighborhood arguments: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        }
      }
      const adjacency = buildAdjacencyIndex(entities)
      const neighborIds = Array.from(adjacency.get(parsed.data.entityId) ?? [])
      const entityIndex = buildEntityIndex(entities)
      const neighbors = neighborIds
        .map((id) => entityIndex.get(id))
        .filter((e): e is Entity => Boolean(e))
        .map((e) => ({ id: e.id, name: e.name, type: e.type, tags: e.tags }))
      return { success: true, data: neighbors.slice(0, MAX_TOOL_RESULTS_LIMIT) }
    }
    default:
      return { success: false, error: `Unknown tool: ${name}` }
  }
}

/** Execute a library tool call locally against the studio state. */
export const executeStudioTool = (
  name: string,
  args: Record<string, unknown>,
  entities: Entity[],
  claims: Claim[],
  options?: ToolExecutionOptions,
): { success: boolean; data?: unknown; error?: string } => {
  try {
    const toolMeta = KNOWN_TOOLS[name]
    if (!toolMeta) {
      return { success: false, error: `Unknown tool: ${name}` }
    }

    if (toolMeta.isMutating && !options?.allowWrite) {
      return {
        success: false,
        error: `Execution of mutating tool '${name}' blocked: explicit write permission required`,
      }
    }

    const jsonStr = JSON.stringify(args ?? {})
    if (jsonStr.length > MAX_ARG_PAYLOAD_BYTES) {
      return {
        success: false,
        error: `Tool argument payload exceeds maximum allowed size (${MAX_ARG_PAYLOAD_BYTES} bytes)`,
      }
    }

    return dispatchTool(name, args, entities, claims)
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown tool execution error',
    }
  }
}

/**
 * Validates that a cited identity (entity ID, entity name, or web URL)
 * resolves to a known entity in the library or a fetched web source.
 */
export const validateCitation = (
  citation: string,
  entities: Entity[],
  researchResults?: ResearchResult[],
): boolean => {
  if (!citation) return false
  const trimmed = citation.trim()

  const entityIndex = buildEntityIndex(entities)
  if (entityIndex.has(trimmed)) return true

  if (entities.some((e) => e.name === trimmed)) return true

  if (researchResults && researchResults.some((r) => r.url === trimmed)) {
    return true
  }

  return false
}
