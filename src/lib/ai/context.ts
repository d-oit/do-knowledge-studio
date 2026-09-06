import type { Entity, Claim } from '@/lib/studio/types'
import type { ChatMessage } from './types'
import { search } from '@/lib/search/retrieval'
import { searchAsync } from '@/lib/search/search-worker-client'
import { buildEntityIndex } from '@/lib/studio/graph-index'
import type { ResearchResult } from './research'
import { buildResearchContext } from './research'

/** Base system prompt instructing the assistant to use local library context. */
const SYSTEM_PROMPT_BASE =
  'You are assisting with a local knowledge base. Use the provided entities to inform your answers when applicable. Be concise and cite entity names when relevant.'

/** Options controlling context injection budgets and formatting. */
export interface ContextBudgetOptions {
  /** Maximum number of relevant search results to include (default: 5). */
  maxResults?: number
  /** Maximum snippet character length per item (default: 200). */
  maxSnippetLength?: number
}

/** Formats a set of search results into prompt context parts. */
const formatLocalContextFromResults = (
  entities: Entity[],
  results: import('@/lib/search/retrieval').SearchResult[],
  maxSnippetLength: number,
): string => {
  if (results.length === 0) return ''

  const entityIndex = buildEntityIndex(entities)
  const contextParts = results.map((r) => {
    const targetId = r.entityId ?? r.id
    const entity = entityIndex.get(targetId)
    const tags = entity?.tags ?? []
    const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : ''
    const desc = r.snippet ? `: ${r.snippet.slice(0, maxSnippetLength)}` : ''
    return `- ${r.name}${tagStr}${desc}`
  })

  return `\n\nRelevant entities from your library:\n${contextParts.join('\n')}`
}

/** Formats matching local entities into prompt context parts (synchronous BM25). */
const formatLocalContext = (
  entities: Entity[],
  claims: Claim[],
  query: string,
  maxResults: number,
  maxSnippetLength: number,
): string => {
  const results = search(entities, claims, query, maxResults)
  return formatLocalContextFromResults(entities, results, maxSnippetLength)
}

/** Formats matching local entities into prompt context parts, offloading BM25 to a worker. */
const formatLocalContextAsync = async (
  entities: Entity[],
  claims: Claim[],
  query: string,
  maxResults: number,
  maxSnippetLength: number,
  signal?: AbortSignal,
): Promise<string> => {
  const results = await searchAsync(entities, claims, query, maxResults, signal)
  return formatLocalContextFromResults(entities, results, maxSnippetLength)
}

/** Formats research results into prompt context text. */
const formatResearchSection = (researchResults?: ResearchResult[]): string => {
  if (!researchResults || researchResults.length === 0) return ''
  const researchCtx = buildResearchContext(researchResults)
  if (!researchCtx) return ''
  return `\n${researchCtx}\n\nUse the fetched web content above to inform your answer. Cite URLs when referencing fetched content.`
}

/** Build the system prompt enriched with local entity context and research results. */
export const buildSystemPrompt = (
  query: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
  researchResults?: ResearchResult[],
  options?: ContextBudgetOptions,
): string => {
  let prompt = SYSTEM_PROMPT_BASE
  const maxResults = options?.maxResults ?? 5
  const maxSnippetLength = options?.maxSnippetLength ?? 200

  if (augmentWithLocal && entities.length > 0) {
    prompt += formatLocalContext(entities, claims, query, maxResults, maxSnippetLength)
  }

  prompt += formatResearchSection(researchResults)

  return prompt
}

/**
 * Asynchronous variant of {@link buildSystemPrompt} that offloads the BM25
 * retrieval to the search Web Worker (falling back to synchronous search in
 * environments without worker support). Throws an AbortError when the signal
 * fires mid-retrieval.
 */
export const buildSystemPromptAsync = async (
  query: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
  researchResults?: ResearchResult[],
  options?: ContextBudgetOptions,
  signal?: AbortSignal,
): Promise<string> => {
  let prompt = SYSTEM_PROMPT_BASE
  const maxResults = options?.maxResults ?? 5
  const maxSnippetLength = options?.maxSnippetLength ?? 200

  if (augmentWithLocal && entities.length > 0) {
    prompt += await formatLocalContextAsync(entities, claims, query, maxResults, maxSnippetLength, signal)
  }

  prompt += formatResearchSection(researchResults)

  return prompt
}

/** Build the full message array (system + history + user) for an AI chat request. */
export const buildMessages = (
  history: ChatMessage[],
  userMessage: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
  researchResults?: ResearchResult[],
  options?: ContextBudgetOptions,
): ChatMessage[] => {
  const systemContent = buildSystemPrompt(
    userMessage,
    entities,
    claims,
    augmentWithLocal,
    researchResults,
    options,
  )
  const systemMsg: ChatMessage = { role: 'system', content: systemContent }
  return [systemMsg, ...history, { role: 'user', content: userMessage }]
}

/**
 * Asynchronous variant of {@link buildMessages} that offloads the BM25 retrieval
 * to the search Web Worker. Throws an AbortError when the signal fires.
 */
export const buildMessagesAsync = async (
  history: ChatMessage[],
  userMessage: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
  researchResults?: ResearchResult[],
  options?: ContextBudgetOptions,
  signal?: AbortSignal,
): Promise<ChatMessage[]> => {
  const systemContent = await buildSystemPromptAsync(
    userMessage,
    entities,
    claims,
    augmentWithLocal,
    researchResults,
    options,
    signal,
  )
  const systemMsg: ChatMessage = { role: 'system', content: systemContent }
  return [systemMsg, ...history, { role: 'user', content: userMessage }]
}
