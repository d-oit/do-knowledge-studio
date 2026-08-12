import type { Entity, Claim } from '@/lib/studio/types'

/** BM25 tuning constant for term frequency saturation. */
const K1 = 1.5
/** BM25 tuning constant for document length normalization. */
const B = 0.75
/** Common English stop words excluded from indexing. */
const STOP_WORDS = new Set([
  'what', 'how', 'why', 'when', 'where', 'which', 'that', 'this',
  'with', 'from', 'your', 'about', 'please', 'could', 'would',
  'should', 'have', 'been', 'being', 'were', 'does', 'into',
  'also', 'just', 'only', 'than', 'then', 'them', 'they',
  'their', 'there', 'these', 'those', 'very', 'some', 'more',
  'most', 'such', 'each', 'every', 'both', 'much', 'many',
])

/** A single search result with relevance score and snippet. */
export interface SearchResult {
  id: string
  type: 'entity' | 'claim'
  name: string
  snippet: string
  score: number
  entityId?: string
  entityName?: string
}

interface IndexEntry {
  id: string
  type: 'entity' | 'claim'
  tokenCount: number
  tfMap: Map<string, number>
  entityId?: string
  entityName?: string
  fullText: string
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

function buildTfMap(tokens: string[]): Map<string, number> {
  const tfMap = new Map<string, number>()
  for (const t of tokens) {
    tfMap.set(t, (tfMap.get(t) ?? 0) + 1)
  }
  return tfMap
}

function buildIndex(
  entities: Entity[],
  claims: Claim[],
  entityMap: Map<string, Entity>,
): IndexEntry[] {
  const entries: IndexEntry[] = []

  for (const e of entities) {
    const text = `${e.name} ${e.description} ${e.content} ${e.tags.join(' ')}`
    const tokens = tokenize(text)
    entries.push({
      id: e.id,
      type: 'entity',
      tokenCount: tokens.length,
      tfMap: buildTfMap(tokens),
      fullText: text,
    })
  }

  for (const c of claims) {
    const entity = entityMap.get(c.entityId)
    const text = `${c.statement} ${c.evidence ?? ''} ${c.source ?? ''}`
    const tokens = tokenize(text)
    entries.push({
      id: c.id,
      type: 'claim',
      tokenCount: tokens.length,
      tfMap: buildTfMap(tokens),
      entityId: c.entityId,
      entityName: entity?.name,
      fullText: text,
    })
  }

  return entries
}

function computeIDF(entries: IndexEntry[], queryTokens: string[]): Map<string, number> {
  const N = entries.length
  const idf = new Map<string, number>()
  for (const qt of queryTokens) {
    let df = 0
    for (const e of entries) {
      if (e.tfMap.has(qt)) {
        df++
      }
    }
    idf.set(qt, Math.log((N - df + 0.5) / (df + 0.5) + 1))
  }
  return idf
}

function bm25Score(
  entry: IndexEntry,
  queryTokens: string[],
  idf: Map<string, number>,
  avgDl: number,
): number {
  let score = 0
  const dl = entry.tokenCount
  const tfMap = entry.tfMap

  // Pre-calculate parts of denominator that don't depend on termFreq
  const bDenom = K1 * (1 - B + B * (dl / avgDl))

  for (const qt of queryTokens) {
    const termFreq = tfMap.get(qt) ?? 0
    if (termFreq === 0) continue

    const idfVal = idf.get(qt) ?? 0
    const numerator = termFreq * (K1 + 1)
    const denominator = termFreq + bDenom
    score += idfVal * (numerator / denominator)
  }
  return score
}

function getSnippet(entry: IndexEntry, maxLength: number = 140): string {
  const text = entry.fullText.trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

// Reference-based cache to avoid rebuilding index and token maps on every search query change
let lastEntities: Entity[] | null = null
let lastClaims: Claim[] | null = null
let cachedEntityMap = new Map<string, Entity>()
let cachedEntries: IndexEntry[] = []
let cachedAvgDl = 0

/** Run a BM25 full-text search over entities and claims. */
export const search = (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit = 5,
): SearchResult[] => {
  let entityMap: Map<string, Entity>
  let entries: IndexEntry[]
  let avgDl: number

  if (entities === lastEntities && claims === lastClaims) {
    entityMap = cachedEntityMap
    entries = cachedEntries
    avgDl = cachedAvgDl
  } else {
    entityMap = new Map<string, Entity>()
    for (const e of entities) {
      entityMap.set(e.id, e)
    }

    entries = buildIndex(entities, claims, entityMap)
    const totalLength = entries.reduce((sum, e) => sum + e.tokenCount, 0)
    avgDl = entries.length > 0 ? totalLength / entries.length : 0

    // Update references and cached indexes
    lastEntities = entities
    lastClaims = claims
    cachedEntityMap = entityMap
    cachedEntries = entries
    cachedAvgDl = avgDl
  }

  if (entries.length === 0) return []

  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const idf = computeIDF(entries, queryTokens)

  const scored = entries
    .map((entry) => ({
      entry,
      score: bm25Score(entry, queryTokens, idf, avgDl),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored.map(({ entry, score }) => ({
    id: entry.id,
    type: entry.type,
    name: entry.type === 'entity'
      ? (entityMap.get(entry.id)?.name ?? entry.id)
      : (entry.entityName ?? entry.id),
    snippet: getSnippet(entry),
    score,
    entityId: entry.entityId,
    entityName: entry.entityName,
  }))
}
