/**
 * In-memory index over loaded bundle concepts: id/name lookup, claims by
 * entity, adjacency from `# Related` links, tag census, and a bundle-scale
 * BM25-lite search. Ranking is intentionally smaller than the studio's full
 * retrieval pipeline; tool descriptions say so.
 */

import type { BundleConcept } from './bundle-reader.js'

/** BM25-lite tuning constant for term-frequency saturation. */
const K1 = 1.2
/** BM25-lite length-normalization constant. */
const B = 0.75
/** Weight applied to name matches (names are the strongest signal). */
const NAME_WEIGHT = 3
/** Weight applied to description matches. */
const DESCRIPTION_WEIGHT = 2
/** Default result cap when the caller passes no limit. */
export const DEFAULT_LIMIT = 5
/** Hard result cap guarding oversized tool responses. */
const MAX_LIMIT = 50

/** Tokenizes text for search: lowercase words of length ≥ 2. */
const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/gu)
    .filter((t) => t.length >= 2)

/** A scored concept returned by search. */
export interface SearchHit {
  /** The matched concept. */
  concept: BundleConcept
  /** BM25-lite score (higher ranks first). */
  score: number
}

/** Read-only index over bundle concepts. */
export class LibraryIndex {
  /** Concepts in bundle order. */
  private readonly concepts: BundleConcept[]
  /** Concept by id. */
  private readonly byId = new Map<string, BundleConcept>()
  /** Concept ids by lowercase name. */
  private readonly idsByName = new Map<string, string[]>()
  /** Document frequency per term. */
  private readonly docFreq = new Map<string, number>()
  /** Average document length in tokens. */
  private readonly avgLen: number

  /** Builds the index; keeps bundle order for stable ties. */
  constructor(concepts: BundleConcept[]) {
    this.concepts = [...concepts]
    let totalLen = 0
    for (const c of concepts) {
      this.byId.set(c.id, c)
      const key = c.name.toLowerCase()
      this.idsByName.set(key, [...(this.idsByName.get(key) ?? []), c.id])
      const terms = new Set(
        tokenize(`${c.name}\n${c.description}\n${c.content}\n${c.claims.map((cl) => cl.statement).join('\n')}`),
      )
      for (const t of terms) this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1)
      totalLen += tokenize(`${c.name}\n${c.description}\n${c.content}\n${c.claims.map((cl) => cl.statement).join('\n')}`).length
    }
    this.avgLen = concepts.length ? totalLen / concepts.length : 1
  }

  /** Number of indexed concepts. */
  get size(): number {
    return this.concepts.length
  }

  /** Finds a concept by exact id. */
  getById(id: string): BundleConcept | undefined {
    return this.byId.get(id)
  }

  /** Finds concept ids sharing a case-insensitive name. */
  getIdsByName(name: string): string[] {
    return this.idsByName.get(name.toLowerCase()) ?? []
  }

  /**
   * Resolves an `id-or-name` reference: exact id first, then unique name.
   * @param ref - Concept id or name.
   * @returns The concept, or an error describing ambiguity/absence.
   */
  resolve(ref: string): { concept: BundleConcept } | { error: string } {
    const byId = this.byId.get(ref)
    if (byId) return { concept: byId }
    const ids = this.getIdsByName(ref)
    if (ids.length === 1) {
      const found = this.byId.get(ids[0] ?? '')
      if (found) return { concept: found }
    }
    if (ids.length > 1) {
      return { error: `"${ref}" names ${ids.length} concepts; pass an id instead: ${ids.join(', ')}.` }
    }
    return { error: `No concept found for "${ref}".` }
  }

  /** All concepts in bundle order. */
  all(): BundleConcept[] {
    return [...this.concepts]
  }

  /** Tag census sorted by count desc, then name. */
  tags(): Array<{ tag: string; count: number }> {
    const counts = new Map<string, number>()
    for (const c of this.concepts) {
      for (const t of new Set(c.tags)) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }

  /**
   * Ranks concepts against a query with BM25-lite over name (×3),
   * description (×2), content, and claim statements.
   * @param query - Raw query text.
   * @param limit - Max hits (clamped to 1..MAX_LIMIT).
   * @returns Hits ordered by score desc, bundle order breaking ties.
   */
  search(query: string, limit = DEFAULT_LIMIT): SearchHit[] {
    const terms = tokenize(query)
    if (terms.length === 0) return []
    const capped = Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT)
    const total = this.concepts.length
    const scored: SearchHit[] = []
    for (const concept of this.concepts) {
      // Field token arrays (not joined strings): document length must be
      // measured in tokens to match `avgLen`.
      const fields = {
        name: tokenize(concept.name),
        description: tokenize(concept.description),
        content: [...tokenize(concept.content), ...concept.claims.flatMap((c) => tokenize(c.statement))],
      }
      const len = fields.name.length + fields.description.length + fields.content.length
      let score = 0
      for (const term of new Set(terms)) {
        const df = this.docFreq.get(term) ?? 0
        if (!df) continue
        const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5))
        const countIn = (tokens: string[]): number =>
          tokens.reduce((n, t) => (t === term ? n + 1 : n), 0)
        const tf =
          countIn(fields.name) * NAME_WEIGHT +
          countIn(fields.description) * DESCRIPTION_WEIGHT +
          countIn(fields.content)
        if (!tf) continue
        score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 + B * (len / this.avgLen - 1))))
      }
      if (score > 0) scored.push({ concept, score })
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, capped)
  }

  /**
   * One-hop neighborhood: concepts this concept links to plus concepts
   * linking back, with dangling targets dropped.
   * @param id - Concept id.
   * @returns Outgoing and incoming neighbors.
   */
  neighborhood(id: string): { outgoing: BundleConcept[]; incoming: BundleConcept[] } {
    const outgoing: BundleConcept[] = []
    for (const target of this.byId.get(id)?.relatedIds ?? []) {
      const found = this.byId.get(target)
      if (found) outgoing.push(found)
    }
    const incoming = this.concepts.filter(
      (c) => c.id !== id && c.relatedIds.includes(id),
    )
    return { outgoing, incoming }
  }
}
