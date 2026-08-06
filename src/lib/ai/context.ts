import type { Entity, Claim } from '@/lib/studio/types'
import type { ChatMessage } from './types'
import { search } from '@/lib/search/retrieval'
import type { ResearchResult } from './research'
import { buildResearchContext } from './research'

/** Base system prompt instructing the assistant to use local library context. */
const SYSTEM_PROMPT_BASE =
  'You are assisting with a local knowledge base. Use the provided entities to inform your answers when applicable. Be concise and cite entity names when relevant.'

/** Build the system prompt enriched with local entity context and research results. */
export function buildSystemPrompt(
  query: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
  researchResults?: ResearchResult[],
): string {
  let prompt = SYSTEM_PROMPT_BASE

  if (augmentWithLocal && entities.length > 0) {
    const results = search(entities, claims, query, 5)
    if (results.length > 0) {
      const contextParts = results.map((r) => {
        const tags: string[] = []
        const entity = entities.find((e) => e.id === r.entityId)
        if (entity && entity.tags.length > 0) tags.push(...entity.tags)
        const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : ''
        const desc = r.snippet ? `: ${r.snippet.slice(0, 200)}` : ''
        return `- ${r.name}${tagStr}${desc}`
      })
      prompt += `\n\nRelevant entities from your library:\n${contextParts.join('\n')}`
    }
  }

  if (researchResults && researchResults.length > 0) {
    const researchCtx = buildResearchContext(researchResults)
    if (researchCtx) {
      prompt += `\n${researchCtx}`
      prompt += '\n\nUse the fetched web content above to inform your answer. Cite URLs when referencing fetched content.'
    }
  }

  return prompt
}

/** Build the full message array (system + history + user) for an AI chat request. */
export function buildMessages(
  history: ChatMessage[],
  userMessage: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
  researchResults?: ResearchResult[],
): ChatMessage[] {
  const systemContent = buildSystemPrompt(
    userMessage,
    entities,
    claims,
    augmentWithLocal,
    researchResults,
  )
  const systemMsg: ChatMessage = { role: 'system', content: systemContent }
  return [systemMsg, ...history, { role: 'user', content: userMessage }]
}
