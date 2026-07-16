import type { Entity, Claim } from '@/lib/studio/types'
import type { ChatMessage } from './types'
import { search } from '@/lib/search/retrieval'

const SYSTEM_PROMPT_BASE =
  'You are assisting with a local knowledge base. Use the provided entities to inform your answers when applicable. Be concise and cite entity names when relevant.'

export function buildSystemPrompt(
  query: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
): string {
  if (!augmentWithLocal || entities.length === 0) return SYSTEM_PROMPT_BASE

  const results = search(entities, claims, query, 5)
  if (results.length === 0) return SYSTEM_PROMPT_BASE

  const contextParts = results.map((r) => {
    const tags: string[] = []
    const entity = entities.find((e) => e.id === r.entityId)
    if (entity) {
      if (entity.tags.length > 0) tags.push(...entity.tags)
    }
    const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : ''
    const desc = r.snippet ? `: ${r.snippet.slice(0, 200)}` : ''
    return `- ${r.name}${tagStr}${desc}`
  })

  return `${SYSTEM_PROMPT_BASE}\n\nRelevant entities from your library:\n${contextParts.join('\n')}`
}

export function buildMessages(
  history: ChatMessage[],
  userMessage: string,
  entities: Entity[],
  claims: Claim[],
  augmentWithLocal: boolean,
): ChatMessage[] {
  const systemContent = buildSystemPrompt(userMessage, entities, claims, augmentWithLocal)
  const systemMsg: ChatMessage = { role: 'system', content: systemContent }
  return [systemMsg, ...history, { role: 'user', content: userMessage }]
}
