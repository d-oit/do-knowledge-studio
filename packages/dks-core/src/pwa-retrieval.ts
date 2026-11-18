/**
 * Lexical BM25 retrieval — the PWA's search engine, single-sourced here.
 *
 * This module is a framework-neutral port of `src/lib/search/retrieval.ts`
 * (K1=1.5, B=0.75, Intl.Segmenter tokenization with ASCII fallback, English
 * stop words, per-entry token memoization, and reference-based caching). The
 * PWA file re-exports from here, and the `dks` CLI / MCP adapter call the
 * same functions, so one implementation serves every consumer. The only
 * changes from the PWA source are structural input interfaces (no `@/`
 * alias imports) and a no-op logger (logging side effects are not part of
 * the retrieval contract).
 */

/** Minimal structural shape of an entity document (PWA `Entity` satisfies it). */
export interface PwaEntityLike {
  id: string
  name: string
  type: string
  description: string
  content: string
  tags: readonly string[]
}

/** Minimal structural shape of a claim document (PWA `Claim` satisfies it). */
export interface PwaClaimLike {
  id: string
  entityId: string
  statement: string
  evidence?: string
  source?: string
}

/** BM25 tuning constant for term frequency saturation. */
const K1 = 1.5
/** BM25 tuning constant for document length normalization. */
const B = 0.75
/** Common English stop words excluded from indexing. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to',
  'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will',
  'just', 'don', 'should', 'now', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'has', 'have', 'had', 'having', 'does', 'did', 'doing', 'would',
  'could', 'ought', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them',
  'his', 'her', 'its', 'our', 'their', 'my', 'your', 'me', 'him', 'us',
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

/** Minimal document metadata a search filter predicate can inspect. */
export interface FilterableDoc {
  id: string
  type: 'entity' | 'claim'
  entityId?: string
  entityName?: string
  entityType?: string
}

/** Predicate that keeps only the documents matching the caller's criteria. */
export type SearchFilter = (doc: FilterableDoc) => boolean

interface IndexEntry extends FilterableDoc {
  tokenCount: number
  tfMap: Map<string, number>
  fullText: string
}

/** No-op logger (PWA uses a structured logger; retrieval itself logs nothing). */
const log: { warn(...args: unknown[]): void } = { warn() {} }

// Lazy, runtime-locale word segmenter (Intl.Segmenter, granularity 'word').
let segmenter: Intl.Segmenter | null = null
let segmenterUnavailable = false
let segmenterFallbackLogged = false

/** Lazy per-runtime word segmenter with a defensive ASCII fallback. */
const getSegmenter = (): Intl.Segmenter | null => {
  if (segmenterUnavailable) return null
  try {
    if (segmenter === null) {
      const segmenterConstructor = Intl.Segmenter
      if (typeof segmenterConstructor !== 'function') return null
      segmenter = new segmenterConstructor(undefined, { granularity: 'word' })
    }
    return segmenter
  } catch {
    segmenterUnavailable = true
    return null
  }
}

/** ASCII-only fallback used when Intl.Segmenter is unavailable. */
const tokenizeAsciiFallback = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w))

const tokenize = (text: string): string[] => {
  const tokens: string[] = []
  const seg = getSegmenter()
  if (seg === null) {
    if (!segmenterFallbackLogged) {
      segmenterFallbackLogged = true
      log.warn('Intl.Segmenter unavailable — falling back to ASCII tokenizer')
    }
    return tokenizeAsciiFallback(text)
  }
  try {
    for (const part of seg.segment(text)) {
      if (!part.isWordLike) continue
      const token = part.segment.normalize('NFC').toLowerCase()
      if (!STOP_WORDS.has(token)) {
        tokens.push(token)
      }
    }
  } catch {
    segmenter = null
    segmenterUnavailable = true
    if (!segmenterFallbackLogged) {
      segmenterFallbackLogged = true
      log.warn('Intl.Segmenter failed — falling back to ASCII tokenizer')
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

/** The token-dependent half of a corpus entry, reusable across rebuilds. */
interface TokenizedEntry {
  tokenCount: number
  tfMap: Map<string, number>
  fullText: string
}

const tokenizedById = new Map<string, TokenizedEntry>()

const tokenizeCached = (id: string, text: string): TokenizedEntry => {
  const cached = tokenizedById.get(id)
  if (cached !== undefined && cached.fullText === text) {
    return cached
  }
  const tokens = tokenize(text)
  const next: TokenizedEntry = {
    tokenCount: tokens.length,
    tfMap: buildTfMap(tokens),
    fullText: text,
  }
  tokenizedById.set(id, next)
  return next
}

/** Drop memoized tokenizations whose id is no longer in the corpus. */
const pruneTokenCache = (liveIds: Set<string>): void => {
  for (const id of tokenizedById.keys()) {
    if (!liveIds.has(id)) tokenizedById.delete(id)
  }
}

function buildIndex(
  entities: PwaEntityLike[],
  claims: PwaClaimLike[],
  entityMap: Map<string, PwaEntityLike>,
): IndexEntry[] {
  const entries: IndexEntry[] = []
  const liveIds = new Set<string>()

  for (const e of entities) {
    const text = `${e.name} ${e.description} ${e.content} ${e.tags.join(' ')}`
    liveIds.add(e.id)
    entries.push({
      id: e.id,
      type: 'entity',
      entityType: e.type,
      ...tokenizeCached(e.id, text),
    })
  }

  for (const c of claims) {
    const entity = entityMap.get(c.entityId)
    const text = `${c.statement} ${c.evidence ?? ''} ${c.source ?? ''}`
    liveIds.add(c.id)
    entries.push({
      id: c.id,
      type: 'claim',
      entityId: c.entityId,
      ...(entity?.name !== undefined ? { entityName: entity.name } : {}),
      ...(entity?.type !== undefined ? { entityType: entity.type } : {}),
      ...tokenizeCached(c.id, text),
    })
  }

  pruneTokenCache(liveIds)
  return entries
}

function computeIDF(entries: IndexEntry[], queryTokens: string[]): Map<string, number> {
  const N = entries.length
  const idf = new Map<string, number>()
  for (const qt of queryTokens) {
    let df = 0
    for (const e of entries) {
      for (const token of e.tfMap.keys()) {
        if (token === qt || token.startsWith(qt)) {
          df++
          break
        }
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
  const bDenom = K1 * (1 - B + B * (dl / avgDl))
  for (const qt of queryTokens) {
    const idfVal = idf.get(qt) ?? 0
    if (idfVal === 0) continue
    let termFreq = 0
    for (const [token, freq] of tfMap) {
      if (token === qt || token.startsWith(qt)) termFreq += freq
    }
    if (termFreq === 0) continue
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

let lastEntities: PwaEntityLike[] | null = null
let lastClaims: PwaClaimLike[] | null = null
let cachedEntityMap = new Map<string, PwaEntityLike>()
let cachedEntries: IndexEntry[] = []
let cachedAvgDl = 0

/** Combined entity + claim entries above which the reference cache is bypassed. */
export const MAX_CACHE_ENTRIES = 20_000

/** Clears the module-level reference cache so the next search rebuilds the index. */
export const resetSearchCache = (): void => {
  lastEntities = null
  lastClaims = null
  cachedEntityMap = new Map<string, PwaEntityLike>()
  cachedEntries = []
  cachedAvgDl = 0
  tokenizedById.clear()
}

interface SearchIndex {
  entityMap: Map<string, PwaEntityLike>
  entries: IndexEntry[]
  avgDl: number
}

const buildEntityMap = (entities: PwaEntityLike[]): Map<string, PwaEntityLike> => {
  const entityMap = new Map<string, PwaEntityLike>()
  for (const e of entities) {
    entityMap.set(e.id, e)
  }
  return entityMap
}

/** Returns the cached index when inputs are referentially unchanged, otherwise rebuilds it. */
const getIndex = (entities: PwaEntityLike[], claims: PwaClaimLike[]): SearchIndex => {
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
    resetSearchCache()
  }

  return { entityMap, entries, avgDl }
}

/**
 * Get entities by id from the retrieval index. The returned view is read-only
 * and reuses the cached entity map for unchanged corpus references.
 */
export const getEntityMap = (entities: PwaEntityLike[], claims: PwaClaimLike[]): ReadonlyMap<string, PwaEntityLike> =>
  getIndex(entities, claims).entityMap

/** Mean document length over the entries being ranked. */
const averageTokenCount = (entries: IndexEntry[]): number => {
  if (entries.length === 0) return 0
  return entries.reduce((sum, entry) => sum + entry.tokenCount, 0) / entries.length
}

/**
 * Run a BM25 full-text search over entities and claims. Each query token
 * matches document tokens that equal it or begin with it (prefix matching).
 */
export const search = (
  entities: PwaEntityLike[],
  claims: PwaClaimLike[],
  query: string,
  limit = 5,
  filter?: SearchFilter,
): SearchResult[] => {
  const { entityMap, entries: allEntries, avgDl: corpusAvgDl } = getIndex(entities, claims)
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
    ...(entry.entityId !== undefined ? { entityId: entry.entityId } : {}),
    ...(entry.entityName !== undefined ? { entityName: entry.entityName } : {}),
  }))
}
