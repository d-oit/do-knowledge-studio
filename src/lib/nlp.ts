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

const ENTITY_TYPE_ENTRIES = Object.entries(ENTITY_TYPE_KEYWORDS) as Array<[EntityType, string[]]>

/** Keywords indicating a claim intent. */
const CLAIM_KEYWORDS = ['claim', 'fact', 'statement', 'believe', 'think', 'assert', 'evidence shows']
/** Keywords indicating a search intent. */
const SEARCH_KEYWORDS = ['search', 'find', 'look for', 'show me', 'what do i have']

const NAME_PATTERNS = [
  /(?:create|add|new|note|jot)\s+(?:a\s+|an\s+)?(?:note|concept|person|project)?\s*(?:called|named|about|for)?\s*["']?(.+?)["']?\s*$/i,
  /(?:about|regarding|concerning)\s+["']?(.+?)["']?\s*$/i,
]

const CREATE_PREFIX_REGEX = /^(?:create|add|new|note|jot|record)\s+(?:a\s+|an\s+)?(?:note|concept|person|project)?\s*(?:called|named|about|for)?\s*/i

const DESC_PATTERNS = [
  /(?:that|which|about|describing|says?|states?|is)\s+(.+)/i,
  /:\s*(.+)/,
]

const TAG_LABEL_REGEX = /(?:tag|tags|label|labels)[:\s]+(.+?)(?:\s*$)/i
const HASHTAG_REGEX = /#(\w+)/g

const STATEMENT_PATTERNS = [
  /(?:claim|fact|statement|assert|evidence)\s*(?:that|:)?\s*(.+)/i,
  /(?:i believe|i think|it seems|apparently)\s+(.+)/i,
]

const SEARCH_PREFIX_REGEX = /^(?:search|find|look for|show me|what do i have)\s*(?:for|about|all)?\s*/i

const classifyEntityType = (text: string): EntityType => {
  const lower = text.toLowerCase()
  for (const [type, keywords] of ENTITY_TYPE_ENTRIES) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type
    }
  }
  return 'note'
}

const extractName = (text: string): string => {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  const cleaned = text
    .replace(CREATE_PREFIX_REGEX, '')
    .replace(/["']/g, '')
    .trim()

  return cleaned.slice(0, 100) || text.slice(0, 100)
}

const extractDescription = (text: string): string => {
  for (const pattern of DESC_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1] && match[1].length > 5) return match[1].trim()
  }

  return text.slice(0, 500)
}

const extractTags = (text: string): string[] => {
  const tags: string[] = []

  const labelMatch = text.match(TAG_LABEL_REGEX)
  if (labelMatch?.[1]) {
    tags.push(
      ...labelMatch[1].split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
    )
  }

  const hashtagMatches = text.matchAll(HASHTAG_REGEX)
  for (const match of hashtagMatches) {
    if (match[1]) {
      tags.push(match[1].toLowerCase())
    }
  }

  return [...new Set(tags)].slice(0, 10)
}

const extractStatement = (text: string): string => {
  for (const pattern of STATEMENT_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  return text.trim()
}

/** Counts vowels in a word efficiently without regex match allocations. */
const countVowels = (word: string): number => {
  let count = 0
  for (let i = 0; i < word.length; i++) {
    const ch = word.charCodeAt(i) | 0x20
    if (ch === 97 || ch === 101 || ch === 105 || ch === 111 || ch === 117) {
      count++
    }
  }
  return count
}

/** Parse natural language text into a structured user intent. */
export function parseIntent(text: string): Intent {
  const lower = text.toLowerCase().trim()

  if (SEARCH_KEYWORDS.some((kw) => lower.startsWith(kw))) {
    const query = text.replace(SEARCH_PREFIX_REGEX, '').trim()
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

  const words = text.split(/\s+/)
  let hasRealWords = false
  for (const w of words) {
    if (w.length >= 3) {
      const vowels = countVowels(w)
      if (vowels >= 2 && vowels / w.length >= 0.3) {
        hasRealWords = true
        break
      }
    }
  }

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
      return 'Unknown intent'
  }
}
