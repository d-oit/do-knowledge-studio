/**
 * Claim conflict messages (#1059).
 */
import { makeT } from '@/lib/i18n/t';

const messages = {
  /** Panel heading. */
  'conflicts.title': 'Claim conflicts',
  /** Suggestion disclaimer. */
  'conflicts.suggestionNote': 'Automatic suggestions only — review each pair before acting.',
  /** Empty state. */
  'conflicts.empty': 'No duplicates or possible contradictions found.',
  /** Duplicate badge. */
  'conflicts.duplicate': 'Duplicate',
  /** Contradiction badge. */
  'conflicts.contradiction': 'Possible contradiction',
  /** Merge action (keeps first, deletes second as undoable). */
  'conflicts.merge': 'Merge',
  /** Mark superseded action. */
  'conflicts.superseded': 'Mark superseded',
  /** Dismiss action. */
  'conflicts.dismiss': 'Dismiss',
  /** Toast after merge. */
  'conflicts.mergedToast': 'Claims merged. Undo reverses it.',
  /** Toast after dismiss. */
  'conflicts.dismissedToast': 'Pair dismissed.',
} as const;

/** Typed translate helper for the conflicts scope. */
export const translate = makeT(messages);
