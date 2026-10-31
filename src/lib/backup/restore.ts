/**
 * Restore preview and composition for verified backups (Issue #1040).
 *
 * Verification proves the archive is intact; this module decides what applying
 * it would change. Preview is side-effect free. The caller receives the exact
 * final arrays and only then invokes the store's atomic import-with-rollback
 * action, so an invalid reference or a user cancellation never mutates
 * canonical state.
 */
import type { Entity, Claim } from '@/lib/studio/types'
import type { ValidatedGraph, ValidatedLink, ValidatedMindMap, ValidatedTag } from '@/lib/studio/schema'
import { CURRENT_SCHEMA_VERSION } from '@/lib/studio/migrations'
import type { VerifiedBackup } from './archive'

/** How an archive is applied to the current corpus. */
export type RestoreMode = 'replace' | 'merge'

/** What happens when an incoming id already exists during a merge. */
export type DuplicatePolicy = 'skip' | 'overwrite'

export interface RestoreOptions {
  mode: RestoreMode
  duplicatePolicy: DuplicatePolicy
}

/** Current corpus slice needed to evaluate a restore. */
export interface RestoreTarget {
  entities: Entity[]
  claims: Claim[]
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
}

/** Side-effect-free description of a pending restore. */
export interface RestorePreview {
  backup: VerifiedBackup
  entities: Entity[]
  claims: Claim[]
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
  duplicateEntityIds: string[]
  duplicateClaimIds: string[]
  warnings: string[]
}

/** The exact corpus a confirmed restore would write. */
export interface ComposedRestore {
  entities: Entity[]
  claims: Claim[]
  graph?: ValidatedGraph
  mindMap?: ValidatedMindMap
  links?: ValidatedLink[]
  tags?: ValidatedTag[]
  warnings: string[]
}

const duplicateIds = (currentIds: Set<string>, incoming: { id: string }[]): string[] =>
  incoming.filter((record) => currentIds.has(record.id)).map((record) => record.id)

/** Build a preview against the current corpus; never mutates either side. */
export const buildRestorePreview = (
  backup: VerifiedBackup,
  current: RestoreTarget,
): RestorePreview => {
  const duplicateEntityIds = duplicateIds(
    new Set(current.entities.map((entity) => entity.id)),
    backup.entities,
  )
  const duplicateClaimIds = duplicateIds(
    new Set(current.claims.map((claim) => claim.id)),
    backup.claims,
  )
  const warnings: string[] = []
  if (backup.manifest.schemaVersion < CURRENT_SCHEMA_VERSION) {
    warnings.push('This archive was written by an older schema version.')
  }
  if (duplicateEntityIds.length > 0 || duplicateClaimIds.length > 0) {
    warnings.push(
      `${duplicateEntityIds.length} entity and ${duplicateClaimIds.length} claim id(s) already exist in the library.`,
    )
  }
  return {
    backup,
    entities: backup.entities,
    claims: backup.claims,
    graph: backup.graph ?? undefined,
    mindMap: backup.mindMap ?? undefined,
    links: backup.links ?? undefined,
    tags: backup.tags ?? undefined,
    duplicateEntityIds,
    duplicateClaimIds,
    warnings,
  }
}

/** Merge records by id, preserving current order and appending new ids. */
const mergeRecords = <T extends { id: string }>(
  current: T[],
  incoming: T[],
  policy: DuplicatePolicy,
): T[] => {
  const incomingById = new Map(incoming.map((record) => [record.id, record]))
  const merged = current.map((record) => {
    const replacement = incomingById.get(record.id)
    if (replacement === undefined) return record
    incomingById.delete(record.id)
    return policy === 'overwrite' ? replacement : record
  })
  return [...merged, ...incomingById.values()]
}

/** Combine two optional arrays by id. */
const mergeOptionalRecords = <T extends { id: string }>(
  current: T[] | undefined,
  incoming: T[] | undefined,
  policy: DuplicatePolicy,
): T[] | undefined => {
  if (incoming === undefined) return current
  if (current === undefined) return incoming
  return mergeRecords(current, incoming, policy)
}

/** Merge graph/mind-map node and edge arrays while preserving node order. */
const mergeGraph = (
  current: ValidatedGraph | undefined,
  incoming: ValidatedGraph | undefined,
  policy: DuplicatePolicy,
): ValidatedGraph | undefined => {
  if (incoming === undefined) return current
  if (current === undefined) return incoming
  return {
    nodes: mergeRecords(current.nodes, incoming.nodes, policy) as ValidatedGraph['nodes'],
    edges: mergeRecords(current.edges, incoming.edges, policy) as ValidatedGraph['edges'],
  }
}

const mergeMindMap = (
  current: ValidatedMindMap | undefined,
  incoming: ValidatedMindMap | undefined,
  policy: DuplicatePolicy,
): ValidatedMindMap | undefined => {
  if (incoming === undefined) return current
  if (current === undefined) return incoming
  return {
    nodes: mergeRecords(current.nodes, incoming.nodes, policy) as ValidatedMindMap['nodes'],
    edges: mergeRecords(current.edges, incoming.edges, policy) as ValidatedMindMap['edges'],
  }
}

/**
 * Compose the final restore payload.
 *
 * Replace is the default user flow after an explicit preview. Merge keeps the
 * current corpus and treats duplicate ids according to the chosen policy;
 * `skip` is the safe default because it never destroys an existing edit.
 */
export const composeRestore = (
  preview: RestorePreview,
  current: RestoreTarget,
  options: RestoreOptions,
): ComposedRestore => {
  const warnings = [...preview.warnings]
  if (options.mode === 'replace') {
    return {
      entities: preview.backup.entities,
      claims: preview.backup.claims,
      graph: preview.backup.graph ?? undefined,
      mindMap: preview.backup.mindMap ?? undefined,
      links: preview.backup.links ?? undefined,
      tags: preview.backup.tags ?? undefined,
      warnings,
    }
  }

  if (
    options.duplicatePolicy === 'skip' &&
    (preview.duplicateEntityIds.length > 0 || preview.duplicateClaimIds.length > 0)
  ) {
    warnings.push('Existing records with the same ids were kept; incoming duplicates were skipped.')
  }
  return {
    entities: mergeRecords(current.entities, preview.backup.entities, options.duplicatePolicy),
    claims: mergeRecords(current.claims, preview.backup.claims, options.duplicatePolicy),
    graph: mergeGraph(current.graph, preview.backup.graph ?? undefined, options.duplicatePolicy),
    mindMap: mergeMindMap(current.mindMap, preview.backup.mindMap ?? undefined, options.duplicatePolicy),
    links: mergeOptionalRecords(current.links, preview.backup.links ?? undefined, options.duplicatePolicy),
    tags: mergeOptionalRecords(current.tags, preview.backup.tags ?? undefined, options.duplicatePolicy),
    warnings,
  }
}
