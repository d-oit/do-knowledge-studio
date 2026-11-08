/**
 * Duplicate detection for proposed entities (#1057).
 *
 * A model routinely re-proposes something the corpus already holds ("Local
 * first" for "Local-first software"). The inbox flags those instead of hiding
 * them: the person decides, and the flag is only ever a hint.
 *
 * Name similarity is token overlap (Jaccard) rather than an embedding call:
 * extraction must stay usable offline and with the local provider, and a
 * duplicate label that costs a network round trip would not be shown at all.
 */
import type { Entity } from '@/lib/studio/types'

/** Similarity at which two names count as the same entity. */
export const DUPLICATE_NAME_SIMILARITY = 0.8

/** Case- and whitespace-insensitive form of an entity name. */
export const normalizeEntityName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

/** Unicode-aware word tokens, so non-Latin names are not split apart. */
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu

/** Word tokens of a normalized name. */
export const tokenizeEntityName = (name: string): string[] =>
  [...normalizeEntityName(name).matchAll(TOKEN_PATTERN)].map((match) => match[0])

/** Jaccard similarity of two names' token sets (0..1). */
export const nameSimilarity = (a: string, b: string): number => {
  const left = new Set(tokenizeEntityName(a))
  const right = new Set(tokenizeEntityName(b))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return shared / (left.size + right.size - shared)
}

/**
 * The existing entity a proposal most likely restates.
 *
 * An exact normalized-name match wins outright; otherwise the most similar
 * name above {@link DUPLICATE_NAME_SIMILARITY} is returned. Ties keep the
 * first entity in corpus order, which is stable across renders.
 */
export const findDuplicateEntity = (
  name: string,
  entities: readonly Entity[],
): Entity | null => {
  const normalized = normalizeEntityName(name)
  if (normalized === '') return null
  let best: { entity: Entity; score: number } | null = null
  for (const entity of entities) {
    if (normalizeEntityName(entity.name) === normalized) return entity
    const score = nameSimilarity(name, entity.name)
    if (score < DUPLICATE_NAME_SIMILARITY) continue
    if (best === null || score > best.score) best = { entity, score }
  }
  return best?.entity ?? null
}
