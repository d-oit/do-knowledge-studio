import { makeT } from '../t'

/**
 * User-facing strings for the entity revision panel (#1060).
 * Typed via `makeT`; no string is inlined in the component.
 */
const messages = {
  'revisions.title': 'History',
  'revisions.empty':
    'No earlier versions yet. Once this note changes, the previous version is kept here so you can compare or restore it.',
  'revisions.loading': 'Loading history…',
  'revisions.error': 'Revision history could not be loaded. Your note is unaffected.',
  'revisions.usage': (count: string, bytes: string) => `${count} versions · ${bytes}`,
  'revisions.count': (n: string) => `${n} ${n === '1' ? 'version' : 'versions'}`,
  'revisions.reason.save': 'Edit',
  'revisions.reason.merge': 'Before merge',
  'revisions.reason.import': 'Before import',
  'revisions.reason.restore': 'Before restore',
  'revisions.diffTitle': 'Compared with the current note',
  'revisions.noDiff': 'Identical to the current note.',
  'revisions.truncated': 'Only the first lines are compared.',
  'revisions.selectLabel': 'Select a version to compare',
  'revisions.restore': 'Restore this version',
  'revisions.restoreAria': (when: string) => `Restore the version from ${when}`,
  'revisions.restored': 'Version restored. Undo returns to the previous text.',
  'revisions.diffRemoved': 'Would be restored',
  'revisions.diffAdded': 'Would be removed',
  'revisions.newer': 'Newer versions are kept first',
} as const

/** Typed `translate` helper bound to the revision message scope. */
export const translate = makeT(messages)
