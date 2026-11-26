/**
 * OKF v0.2 bundle import — thin adapter over the shared `dks-core` service.
 *
 * Every validation/parsing rule (drive-rooted path guards, reserved
 * index.md/log.md handling, `okf_version` checks, frontmatter parsing,
 * claim extraction, trust derivation) lives once in
 * `packages/dks-core/src/okf-parse.ts` (`parseOkfImportBundle`). This file
 * only maps the neutral result onto studio Entity/Claim records (UUIDs,
 * presentation fields), preserving the PWA's public behavior.
 */

import { parseOkfImportBundle } from 'dks-core/okf-parse'
import type { Entity, Claim } from '@/lib/studio/types'

/** Relation label minted for round-tripped `# Related` concept links. */
const OKF_RELATED_RELATION = 'related'

/**
 * Generates a UUID v4. Uses the Web Crypto API when available (browsers and
 * modern Node), falling back to a crypto.getRandomValues-based v4 for runtimes
 * without `crypto.randomUUID`. Throws only when no Web Crypto exists at all
 * (exotic runtime) rather than emitting weak random IDs.
 * @returns A UUID v4 string.
 */
const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  throw new Error('Web Crypto API unavailable; cannot generate claim IDs')
}

/** Result of parsing an OKF bundle: entities, claims, and non-fatal errors. */
export interface OkfImportResult {
  entities: Entity[]
  claims: Claim[]
  errors: string[]
}

/**
 * Parse an OKF bundle (path → content) back into studio state using the
 * shared validation service; only record mapping happens here.
 */
export const parseOkfBundle = (files: Map<string, string>): OkfImportResult => {
  const imported = parseOkfImportBundle(files)
  const entities: Entity[] = imported.entities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type as Entity['type'],
    description: e.description,
    content: e.content,
    tags: e.tags,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    links: e.relatedIds.map((targetId) => ({ targetId, relation: OKF_RELATED_RELATION })),
  }))
  const claims: Claim[] = imported.claims.map((c) => ({
    id: uuid(),
    statement: c.statement,
    entityId: c.entityId,
    confidence: c.confidence,
    verification: c.verification as Claim['verification'],
    ...(c.source !== undefined ? { source: c.source } : {}),
    ...(c.evidence !== undefined ? { evidence: c.evidence } : {}),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    version: c.version,
    editHistory: [],
  }))
  return { entities, claims, errors: imported.errors }
}
