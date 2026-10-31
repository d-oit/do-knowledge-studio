/**
 * Pure in-memory vector index primitives (Issue #1037 split).
 *
 * Kept separate from build orchestration so the ranking data structure stays
 * understandable and independently testable.
 */
import type { FilterableDoc, SearchFilter } from './retrieval'

/** A searchable unit: an entity or one of its claims. */
export interface SemanticDoc extends FilterableDoc {
  name: string
  fullText: string
  entityName?: string
}

/** Optional predicate to narrow vector search by document metadata. */
export type SemanticDocFilter = SearchFilter

/** Serializable snapshot of the in-memory index. */
export interface VectorStoreSnapshot {
  docs: SemanticDoc[]
  vectors: { id: string; vector: number[] }[]
}

/** L2-normalizes a vector (returns a new array). */
export const normalizeVector = (vec: number[]): number[] => {
  const magnitude = Math.hypot(...vec)
  return magnitude === 0 ? vec.slice() : vec.map((value) => value / magnitude)
}

/** Dot product over pre-normalized vectors (= cosine similarity). */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  const len = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < len; i += 1) dot += a[i] * b[i]
  return dot
}

/**
 * In-memory vector index mapping document ids to normalized embeddings.
 * Insertions normalize defensively, so raw (unnormalized) vectors are safe.
 */
export class VectorStore {
  private docs = new Map<string, SemanticDoc>()
  private vectors = new Map<string, number[]>()

  /** Number of indexed documents. */
  get size(): number {
    return this.docs.size
  }

  /** Whether a document id is currently indexed. */
  has(id: string): boolean {
    return this.docs.has(id) && this.vectors.has(id)
  }

  /** Approximate bytes held by document text and vectors. */
  getMemoryBytes(): number {
    let bytes = 0
    for (const [id, vector] of this.vectors) {
      const doc = this.docs.get(id)
      bytes += doc === undefined ? 0 : doc.fullText.length * 2
      bytes += vector.length * 4
    }
    return bytes
  }

  /** Indexed document ids (snapshot). */
  ids(): string[] {
    return Array.from(this.docs.keys())
  }

  /** Indexes a document with its embedding (normalized on write). */
  add(doc: SemanticDoc, vector: number[]): void {
    this.docs.set(doc.id, doc)
    this.vectors.set(doc.id, normalizeVector(vector))
  }

  /** Indexes or replaces a document with its embedding. */
  upsert(doc: SemanticDoc, vector: number[]): void {
    this.add(doc, vector)
  }

  /** Removes a document (no-op when the id is absent). */
  remove(id: string): void {
    this.docs.delete(id)
    this.vectors.delete(id)
  }

  /** Drops every document and vector. */
  clear(): void {
    this.docs.clear()
    this.vectors.clear()
  }

  /**
   * Returns the top-K documents ranked by cosine similarity to the query
   * vector, optionally restricted by a document filter.
   */
  search(
    queryVector: number[],
    topK = 5,
    filter?: SemanticDocFilter,
  ): { id: string; score: number; doc: SemanticDoc }[] {
    if (this.docs.size === 0 || topK <= 0) return []
    const query = normalizeVector(queryVector)
    const scored: { id: string; score: number; doc: SemanticDoc }[] = []
    for (const [id, doc] of this.docs) {
      if (filter && !filter(doc)) continue
      const vector = this.vectors.get(id)
      if (vector === undefined) continue
      scored.push({ id, score: cosineSimilarity(query, vector), doc })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  /** JSON-safe snapshot for optional persistence. */
  snapshot(): VectorStoreSnapshot {
    return {
      docs: Array.from(this.docs.values()),
      vectors: Array.from(this.vectors.entries()).map(([id, vector]) => ({
        id,
        vector: normalizeVector(vector),
      })),
    }
  }

  /** Replaces the index contents from a snapshot (missing ids are dropped). */
  restore(snapshot: VectorStoreSnapshot): void {
    this.clear()
    for (const doc of snapshot.docs) {
      const vector = snapshot.vectors.find((entry) => entry.id === doc.id)?.vector
      if (vector !== undefined) this.add(doc, vector)
    }
  }
}
