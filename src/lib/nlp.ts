import type { EntityType } from '@/lib/studio/types'

/** Discriminated union of parsed user intents. */
export type Intent =
  | { type: 'create_entity'; name: string; entityType: EntityType; description: string; tags: string[] }
  | { type: 'add_claim'; entityId?: string; statement: string; confidence: number }
  | { type: 'search'; query: string }
  | { type: 'unknown'; raw: string }

/** Keyword sets used to classify entity types from natural language. */
const ENTITY_TYPE_KEYWORDS: Record<EntityType, string[]> = {
  person: ['person', 'people', 'contact', 'someone'],
  project: ['project', 'task', 'todo', 'initiative', 'effort'],
  concept: ['concept', 'idea', 'notion', 'theory', 'principle'],
  note: ['note', 'jot', 'write down', 'record', 'memo'],
}

/** Keywords indicating a claim intent. */
const CLAIM_KEYWORDS = ['claim', 'fact', 'statement', 'believe', 'think', 'assert', 'evidence shows']
/** Keywords indicating a search intent. */
const SEARCH_KEYWORDS = ['search', 'find', 'look for', 'show me', 'what do i have']

function classifyEntityType(text: string): EntityType {
  const lower = text.toLowerCase()
  for (const [type, keywords] of Object.entries(ENTITY_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type as EntityType
    }
  }
  return 'note'
}

function extractName(text: string): string {
  const patterns = [
    /(?:create|add|new|note|jot)\s+(?:a\s+|an\s+)?(?:note|concept|person|project)?\s*(?:called|named|about|for)?\s*["']?(.+?)["']?\s*$/i,
    /(?:about|regarding|concerning)\s+["']?(.+?)["']?\s*$/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  const cleaned = text
    .replace(/^(?:create|add|new|note|jot|record)\s+(?:a\s+|an\s+)?(?:note|concept|person|project)?\s*(?:called|named|about|for)?\s*/i, '')
    .replace(/["']/g, '')
    .trim()

  return cleaned.slice(0, 100) || text.slice(0, 100)
}

function extractDescription(text: string): string {
  const patterns = [
    /(?:that|which|about|describing|says?|states?|is)\s+(.+)/i,
    /:\s*(.+)/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1] && match[1].length > 5) return match[1].trim()
  }

  return text.slice(0, 500)
}

function extractTags(text: string): string[] {
  const tags: string[] = []

  const labelMatch = text.match(/(?:tag|tags|label|labels)[:\s]+(.+?)(?:\s*$)/i)
  if (labelMatch?.[1]) {
    tags.push(
      ...labelMatch[1].split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
    )
  }

  const hashtagMatches = text.matchAll(/#(\w+)/g)
  for (const match of hashtagMatches) {
    if (match[1]) {
      tags.push(match[1].toLowerCase())
    }
  }

  return [...new Set(tags)].slice(0, 10)
}

function extractStatement(text: string): string {
  const patterns = [
    /(?:claim|fact|statement|assert|evidence)\s*(?:that|:)?\s*(.+)/i,
    /(?:i believe|i think|it seems|apparently)\s+(.+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  return text.trim()
}

/** Parse natural language text into a structured user intent. */
export function parseIntent(text: string): Intent {
  const lower = text.toLowerCase().trim()

  if (SEARCH_KEYWORDS.some((kw) => lower.startsWith(kw))) {
    const query = text.replace(/^(?:search|find|look for|show me|what do i have)\s*(?:for|about|all)?\s*/i, '').trim()
    return { type: 'search', query: query || text }
  }

  if (CLAIM_KEYWORDS.some((kw) => lower.includes(kw))) {
    const statement = extractStatement(text)
    return { type: 'add_claim', statement, confidence: 0.7 }
  }

  const entityType = classifyEntityType(text)
  const name = extractName(text)
  const description = extractDescription(text)
  const tags = extractTags(text)

  const words = text.split(/\s+/).filter((w) => w.length >= 3)
  const hasRealWords = words.some((w) => {
    const vowels = (w.match(/[aeiou]/gi) ?? []).length
    return vowels >= 2 && vowels / w.length >= 0.3
  })
  if (name.length > 2 && hasRealWords) {
    return { type: 'create_entity', name, entityType, description, tags }
  }

  return { type: 'unknown', raw: text }
}

/** Format a parsed intent into a human-readable summary string. */
export function formatIntentSummary(intent: Intent): string {
  switch (intent.type) {
    case 'create_entity':
      return `Create ${intent.entityType}: "${intent.name}"`
    case 'add_claim':
      return `Add claim: "${intent.statement.slice(0, 60)}${intent.statement.length > 60 ? '…' : ''}"`
    case 'search':
      return `Search: "${intent.query}"`
    case 'unknown':
      return `Unrecognized: "${intent.raw.slice(0, 60)}${intent.raw.length > 60 ? '…' : ''}"`
    default:
      return `Unknown intent`
  }
}
