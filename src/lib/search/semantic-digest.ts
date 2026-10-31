/**
 * Deterministic fingerprints for incremental semantic indexing (#1037).
 *
 * A document fingerprint captures every field that affects its embedding or
 * filter metadata. The corpus digest orders ids + fingerprints so equal corpora
 * produce the same cache key regardless of array order.
 */
import {
  EMBED_MAX_CHARS,
  EMBED_POOLING,
  EMBEDDING_DEVICE,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL_ID,
} from './embeddings'
import type { SemanticDoc } from './vector-index'

/** Fingerprint of the embedding model and preprocessing contract. */
export const SEMANTIC_MODEL_FINGERPRINT = [
  'v1',
  EMBEDDING_MODEL_ID,
  EMBEDDING_DTYPE,
  EMBEDDING_DEVICE,
  String(EMBED_MAX_CHARS),
  EMBED_POOLING,
].join(':')

/** Stable per-document fingerprint: text plus metadata used by ranking/filters. */
export const fingerprintOf = (doc: SemanticDoc): string =>
  [doc.type, doc.entityId ?? '', doc.entityType ?? '', doc.name, doc.fullText].join('\u0000')

/** SHA-256 hex; a deterministic fallback keeps old runtimes/tests working. */
const digestText = async (text: string): Promise<string> => {
  const subtle = globalThis.crypto?.subtle
  if (subtle !== undefined) {
    const bytes = new TextEncoder().encode(text)
    const digest = await subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`
}

/** Digest of the ordered document ids and content fingerprints. */
export const computeCorpusDigest = async (docs: SemanticDoc[]): Promise<string> =>
  digestText(
    docs
      .map((doc) => `${doc.id}\u0000${fingerprintOf(doc)}`)
      .sort()
      .join('\n'),
  )
