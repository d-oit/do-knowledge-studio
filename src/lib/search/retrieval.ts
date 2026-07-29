import type { Entity, Claim } from '@/lib/studio/types'

const K1 = 1.5
const B = 0.75
const STOP_WORDS = new Set([
  'what', 'how', 'why', 'when', 'where', 'which', 'that', 'this',
  'with', 'from', 'your', 'about', 'please', 'could', 'would',
  'should', 'have', 'been', 'being', 'were', 'does', 'into',
  'also', 'just', 'only', 'than', 'then', 'them', 'they',
  'their', 'there', 'these', 'those', 'very', 'some', 'more',
  'most', 'such', 'each', 'every', 'both', 'much', 'many',
])

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
  tokens: string[]
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

function buildIndex(
  entities: Entity[],
  claims: Claim[],
  entityMap: Map<string, Entity>,
): IndexEntry[] {
  const entries: IndexEntry[] = []

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    const text = `${e.name} ${e.description} ${e.content} ${e.tags.join(' ')}`
    const tokens = tokenize(text)
    const tfMap = new Map<string, number>()
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j]
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1)
    }
    entries.push({
      id: e.id,
      type: 'entity',
      tokens,
      tfMap,
      fullText: text,
    })
  }

  for (let i = 0; i < claims.length; i++) {
    const c = claims[i]
    const entity = entityMap.get(c.entityId)
    const text = `${c.statement} ${c.evidence ?? ''} ${c.source ?? ''}`
    const tokens = tokenize(text)
    const tfMap = new Map<string, number>()
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j]
      tfMap.set(t, (tfMap.get(t) ?? 0) + 1)
    }
    entries.push({
      id: c.id,
      type: 'claim',
      tokens,
      tfMap,
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
  for (let i = 0; i < queryTokens.length; i++) {
    const qt = queryTokens[i]
    let df = 0
    for (let j = 0; j < N; j++) {
      if (entries[j].tfMap.has(qt)) {
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
  const dl = entry.tokens.length
  const tfMap = entry.tfMap

  // Pre-calculate parts of denominator that don't depend on termFreq
  const bDenom = K1 * (1 - B + B * (dl / avgDl))

  for (let i = 0; i < queryTokens.length; i++) {
    const qt = queryTokens[i]
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
  return text.slice(0, maxLength) + '…'
}

export function search(
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit: number = 5,
): SearchResult[] {
  const entityMap = new Map<string, Entity>()
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    entityMap.set(e.id, e)
  }

  const entries = buildIndex(entities, claims, entityMap)
  if (entries.length === 0) return []

  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const idf = computeIDF(entries, queryTokens)
  let totalLength = 0
  for (let i = 0; i < entries.length; i++) {
    totalLength += entries[i].tokens.length
  }
  const avgDl = totalLength / entries.length

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
