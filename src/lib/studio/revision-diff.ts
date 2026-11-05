/**
 * Diffing an entity revision against the current entity (#1060).
 *
 * The panel needs to answer "what would restoring this change?" without a diff
 * library: field-level changes for the metadata, and a line diff for the body.
 * Pure and bounded — a 50k-character note must not turn a list render into an
 * O(n·m) table, so long inputs are truncated to the diff window.
 */
import type { Entity } from './types'

/** Which entity field a metadata change belongs to. */
export type DiffField = 'name' | 'type' | 'description' | 'sourceUrl' | 'tags'

/** One changed metadata field, rendered as before → after. */
export interface FieldChange {
  field: DiffField
  before: string
  after: string
}

/** How one line of the body changed. */
export type DiffLineKind = 'same' | 'added' | 'removed'

/** One line of the body diff. */
export interface DiffLine {
  kind: DiffLineKind
  text: string
}

/** Bounded diff of two entity snapshots. */
export interface EntitySnapshotDiff {
  fields: FieldChange[]
  lines: DiffLine[]
  /** True when the body was truncated to the diff window. */
  truncated: boolean
}

/** Maximum body lines compared on each side. */
export const MAX_DIFF_LINES = 300

/** Maximum line-diff entries produced (roughly `2 × MAX_DIFF_LINES`). */
export const MAX_DIFF_ENTRIES = MAX_DIFF_LINES * 2

/** Renders tags the same way the editor does, for a stable comparison. */
const formatTags = (tags: readonly string[]): string => tags.join(', ')

/** Metadata fields that differ between two snapshots. */
const fieldChanges = (before: Entity, after: Entity): FieldChange[] => {
  const changes: FieldChange[] = []
  if (before.name !== after.name) {
    changes.push({ field: 'name', before: before.name, after: after.name })
  }
  if (before.type !== after.type) {
    changes.push({ field: 'type', before: before.type, after: after.type })
  }
  if (before.description !== after.description) {
    changes.push({ field: 'description', before: before.description, after: after.description })
  }
  if ((before.sourceUrl ?? '') !== (after.sourceUrl ?? '')) {
    changes.push({
      field: 'sourceUrl',
      before: before.sourceUrl ?? '',
      after: after.sourceUrl ?? '',
    })
  }
  if (formatTags(before.tags) !== formatTags(after.tags)) {
    changes.push({
      field: 'tags',
      before: formatTags(before.tags),
      after: formatTags(after.tags),
    })
  }
  return changes
}

/**
 * Longest-common-subsequence line diff.
 *
 * `before` is the revision (what restoring would bring back) and `after` is the
 * current entity, so a line only in the revision is `removed` (restoring would
 * re-add it) and a line only in the current entity is `added` (restoring would
 * drop it). The table is bounded by `MAX_DIFF_LINES` on each side.
 */
const lineDiff = (before: readonly string[], after: readonly string[]): DiffLine[] => {
  const rows = before.length
  const columns = after.length
  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    Array.from({ length: columns + 1 }, () => 0),
  )
  for (let row = rows - 1; row >= 0; row -= 1) {
    const currentRow = table[row]
    if (currentRow === undefined) break
    for (let column = columns - 1; column >= 0; column -= 1) {
      currentRow[column] =
        before[row] === after[column]
          ? (table[row + 1]?.[column + 1] ?? 0) + 1
          : Math.max(table[row + 1]?.[column] ?? 0, currentRow[column + 1] ?? 0)
    }
  }

  const entries: DiffLine[] = []
  let row = 0
  let column = 0
  while (row < rows && column < columns && entries.length < MAX_DIFF_ENTRIES) {
    const beforeLine = before[row] ?? ''
    const afterLine = after[column] ?? ''
    if (beforeLine === afterLine) {
      entries.push({ kind: 'same', text: beforeLine })
      row += 1
      column += 1
    } else if ((table[row + 1]?.[column] ?? 0) >= (table[row]?.[column + 1] ?? 0)) {
      entries.push({ kind: 'removed', text: beforeLine })
      row += 1
    } else {
      entries.push({ kind: 'added', text: afterLine })
      column += 1
    }
  }
  while (row < rows && entries.length < MAX_DIFF_ENTRIES) {
    entries.push({ kind: 'removed', text: before[row] ?? '' })
    row += 1
  }
  while (column < columns && entries.length < MAX_DIFF_ENTRIES) {
    entries.push({ kind: 'added', text: after[column] ?? '' })
    column += 1
  }
  return entries
}

/**
 * Diff a stored revision against the entity as it is now.
 * @param revision - Snapshot that a restore would apply.
 * @param current - Entity currently in the corpus.
 * @returns Metadata changes plus a bounded body line diff.
 */
export const diffEntitySnapshots = (
  revision: Entity,
  current: Entity,
): EntitySnapshotDiff => {
  const beforeLines = revision.content.split('\n')
  const afterLines = current.content.split('\n')
  const truncated = beforeLines.length > MAX_DIFF_LINES || afterLines.length > MAX_DIFF_LINES
  return {
    fields: fieldChanges(revision, current),
    lines: lineDiff(beforeLines.slice(0, MAX_DIFF_LINES), afterLines.slice(0, MAX_DIFF_LINES)),
    truncated,
  }
}
