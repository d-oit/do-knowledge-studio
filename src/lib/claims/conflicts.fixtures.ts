/**
 * Fixture set with known duplicates/contradictions (#1059).
 *
 * Used by `conflicts.test.ts` to measure recall/precision; the numbers are
 * recorded in the PR body. Labels: duplicate, contradiction, unrelated.
 */
import type { Claim } from '@/lib/studio/types';

const makeFixtureClaim = (id: string, entityId: string, statement: string): Claim => ({
  id,
  entityId,
  statement,
  confidence: 0.7,
  verification: 'unverified',
});

export interface LabeledPair {
  readonly idA: string;
  readonly idB: string;
  readonly label: 'duplicate' | 'contradiction' | 'unrelated';
}

export const CONFLICT_FIXTURES: readonly Claim[] = [
  makeFixtureClaim('f1', 'e1', 'The Eiffel Tower is in Paris'),
  makeFixtureClaim('f2', 'e1', 'The Eiffel Tower is in Paris'),
  makeFixtureClaim('f3', 'e1', 'The Eiffel Tower is in Paris France'),
  makeFixtureClaim('f4', 'e1', 'The Eiffel Tower is not in Paris'),
  makeFixtureClaim('f5', 'e1', 'The Eiffel Tower is in Berlin'),
  makeFixtureClaim('f6', 'e1', 'The project launched in 2024'),
  makeFixtureClaim('f7', 'e1', 'The project launched in 2025'),
  makeFixtureClaim('f8', 'e1', 'Photosynthesis converts sunlight into energy'),
  makeFixtureClaim('f9', 'e2', 'The ocean is deep and full of fish'),
];

export const CONFLICT_LABELS: readonly LabeledPair[] = [
  { idA: 'f1', idB: 'f2', label: 'duplicate' },
  { idA: 'f1', idB: 'f3', label: 'duplicate' },
  { idA: 'f1', idB: 'f4', label: 'contradiction' },
  { idA: 'f6', idB: 'f7', label: 'contradiction' },
  { idA: 'f1', idB: 'f8', label: 'unrelated' },
  { idA: 'f1', idB: 'f9', label: 'unrelated' },
  { idA: 'f5', idB: 'f8', label: 'unrelated' },
];
