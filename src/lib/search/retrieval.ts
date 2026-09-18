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

/**
 * Minimal document metadata a search filter predicate can inspect. Shared by
 * the lexical (BM25) and vector paths so one predicate narrows either engine.
 */
export interface FilterableDoc {
  id: string
  type: 'entity' | 'claim'
  /** Owning entity id (claims only). */
  entityId?: string
  /** Type of the document's entity, so callers can filter entities and their claims together. */
  entityType?: string
}

/** Predicate that keeps only the documents matching the caller's criteria. */
export type SearchFilter = (doc: FilterableDoc) => boolean

interface IndexEntry extends FilterableDoc {
  tokenCount: number
  tfMap: Map<string, number>
  entityName?: string
  fullText: string
}

// Lazy, runtime-locale word segmenter (Intl.Segmenter, granularity 'word').
// Constructed once and reused across every index/query call so tokenization
// costs are amortized instead of re-allocating a Segmenter per tokenization.
let segmenter: Intl.Segmenter | null = null
let segmenterUnavailable = false
let segmenterFallbackLogged = false

/** Lazy per-runtime word segmenter with a defensive ASCII fallback. */
const getSegmenter = (): Intl.Segmenter | null => {
  if (segmenter !== null) return segmenter
  if (segmenterUnavailable) return null
  try {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
    return segmenter
  } catch {
    // Remember the failure so we never re-create (and re-log) per tokenize
    // call on a runtime without Intl.Segmenter; the ASCII fallback below runs
    // silently on a legacy environment.
    segmenterUnavailable = true
    return null
  }
}


/**
 * True when a token carries at least one non-ASCII character, i.e. it belongs
 * to a CJK, Cyrillic, accented, or Latin-extension script. Such tokens carry
 * real meaning at 1-2 characters (e.g. a single Han ideograph), so they must
 * not be filtered out by the ASCII-only minimum-length rule.
 *
 * Implemented with a UTF-16 code-unit scan rather than a `[^\x00-\x7f]` regex so
 * the pattern contains no control characters (DeepSource JS-0004 / JS-W1035).
 * Surrogate pairs are visited as two units but the ASCII/non-ASCII verdict is
 * unchanged.
 */
const containsNonAscii = (token: string): boolean => {
  for (let i = 0; i < token.length; i++) {
    if (token.charCodeAt(i) > 0x7f) return true
  }
  return false
}

/** ASCII-only fallback used when Intl.Segmenter is unavailable. */
const tokenizeAsciiFallback = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))

const tokenize = (text: string): string[] => {
  const tokens: string[] = []
  const seg = getSegmenter()
  if (seg === null) {
    // Legacy runtime without Intl.Segmenter — ASCII splitting preserves the
    // previous behavior so indexing degrades gracefully instead of throwing.
    // Log the transition exactly once; caching the failure avoids flooding the
    // console on every tokenized entity/claim in the corpus.
    if (!segmenterFallbackLogged) {
      segmenterFallbackLogged = true
      console.warn('Intl.Segmenter unavailable — falling back to ASCII tokenizer')
    }
    return tokenizeAsciiFallback(text)
  }
  try {
    // Intl.Segmenter splits script-aware word boundaries (per grapheme/word
    // cluster for CJK) and exposes isWordLike so punctuation/whitespace are
    // dropped without clobbering meaningful non-Latin content.
    for (const part of seg.segment(text)) {
      if (!part.isWordLike) continue
      const token = part.segment.normalize('NFC').toLowerCase()
      // Keep English-like tokens of 3+ chars and any non-ASCII word segment
      // (Chinese/Japanese/Korean and composed scripts are meaningful at 1-2
      // characters). The English stop-word list never applies to non-ASCII.
      if (!STOP_WORDS.has(token) && (token.length > 2 || containsNonAscii(token))) {
        tokens.push(token)
      }
    }
  } catch {
    // A segmenter that throws mid-segment is broken: clear the cached instance
    // and mark it unavailable so every later call takes the fallback path
    // instead of reusing the failing segmenter.
    segmenter = null
    segmenterUnavailable = true
    if (!segmenterFallbackLogged) {
      segmenterFallbackLogged = true
      console.warn('Intl.Segmenter failed — falling back to ASCII tokenizer')
    }
    return tokenizeAsciiFallback(text)
  }
  return tokens
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
      entityType: e.type,
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
      entityId: c.entityId,
      entityName: entity?.name,
      entityType: entity?.type,
      tokenCount: tokens.length,
      tfMap: buildTfMap(tokens),
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

/** Combined entity + claim entries above which the reference cache is bypassed. */
export const MAX_CACHE_ENTRIES = 20_000

/** Clears the module-level reference cache so the next search rebuilds the index. */
export const resetSearchCache = (): void => {
  lastEntities = null
  lastClaims = null
  cachedEntityMap = new Map<string, Entity>()
  cachedEntries = []
  cachedAvgDl = 0
}

interface SearchIndex {
  entityMap: Map<string, Entity>
  entries: IndexEntry[]
  avgDl: number
}

const buildEntityMap = (entities: Entity[]): Map<string, Entity> => {
  const entityMap = new Map<string, Entity>()
  for (const e of entities) {
    entityMap.set(e.id, e)
  }
  return entityMap
}

/** Returns the cached index when inputs are referentially unchanged, otherwise rebuilds it. */
const getIndex = (entities: Entity[], claims: Claim[]): SearchIndex => {
  if (entities === lastEntities && claims === lastClaims) {
    return {
      entityMap: cachedEntityMap,
      entries: cachedEntries,
      avgDl: cachedAvgDl,
    }
  }

  const entityMap = buildEntityMap(entities)
  const entries = buildIndex(entities, claims, entityMap)
  const totalLength = entries.reduce((sum, e) => sum + e.tokenCount, 0)
  const avgDl = entries.length > 0 ? totalLength / entries.length : 0

  if (entries.length <= MAX_CACHE_ENTRIES) {
    lastEntities = entities
    lastClaims = claims
    cachedEntityMap = entityMap
    cachedEntries = entries
    cachedAvgDl = avgDl
  } else {
    // Oversized corpora bypass the cache to bound memory; each search rebuilds.
    resetSearchCache()
  }

  return { entityMap, entries, avgDl }
}

/** Mean document length over the entries being ranked. */
const averageTokenCount = (entries: IndexEntry[]): number => {
  if (entries.length === 0) return 0
  return entries.reduce((sum, entry) => sum + entry.tokenCount, 0) / entries.length
}

/** Run a BM25 full-text search over entities and claims. */
export const search = (
  entities: Entity[],
  claims: Claim[],
  query: string,
  limit = 5,
  filter?: SearchFilter,
): SearchResult[] => {
  const { entityMap, entries: allEntries, avgDl: corpusAvgDl } = getIndex(entities, claims)

  // The filter narrows candidates BEFORE ranking and truncation, so
  // filtered-out documents cannot consume the limit, and the IDF/length
  // statistics are computed over the set the query actually ranks.
  const entries = filter === undefined ? allEntries : allEntries.filter(filter)

  if (entries.length === 0) return []

  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const idf = computeIDF(entries, queryTokens)
  const avgDl = filter === undefined ? corpusAvgDl : averageTokenCount(entries)

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
