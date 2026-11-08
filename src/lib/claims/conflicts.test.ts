import { describe, expect, it } from 'vitest';
import {
  classifyPair,
  findClaimConflicts,
  findClaimConflictsAsync,
  jaccardSimilarity,
  tokenizeStatement,
} from './conflicts';
import { CONFLICT_FIXTURES, CONFLICT_LABELS } from './conflicts.fixtures';
import type { Claim } from '@/lib/studio/types';

const makeClaim = (id: string, statement: string): Claim => ({
  id,
  entityId: 'e1',
  statement,
  confidence: 0.5,
  verification: 'unverified',
});

describe('claim conflicts (#1059)', () => {
  it('tokenizes with Intl.Segmenter and scores Jaccard', () => {
    expect(tokenizeStatement('Hello, World!')).toContain('hello');
    expect(jaccardSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(jaccardSimilarity(['a'], ['b'])).toBe(0);
  });

  it('flags identical statements as duplicates', () => {
    const hit = classifyPair(makeClaim('a', 'The sky is blue'), makeClaim('b', 'The sky is blue'));
    expect(hit?.kind).toBe('duplicate');
  });

  it('flags negation as possible contradiction', () => {
    const hit = classifyPair(
      makeClaim('a', 'The reactor is online and stable'),
      makeClaim('b', 'The reactor is not online and stable'),
    );
    expect(hit?.kind).toBe('possible-contradiction');
  });

  it('flags numeric mismatch as possible contradiction', () => {
    const hit = classifyPair(
      makeClaim('a', 'The project launched in 2024'),
      makeClaim('b', 'The project launched in 2025'),
    );
    expect(hit?.kind).toBe('possible-contradiction');
  });

  it('ignores unrelated pairs', () => {
    const hit = classifyPair(
      makeClaim('a', 'Photosynthesis converts sunlight into energy'),
      makeClaim('b', 'The ocean is deep and full of fish'),
    );
    expect(hit).toBeNull();
  });

  it('async scan matches sync ordering', async () => {
    const sync = findClaimConflicts(CONFLICT_FIXTURES);
    const asyncResult = await findClaimConflictsAsync(CONFLICT_FIXTURES);
    expect(asyncResult.map((c) => [c.idA, c.idB, c.kind])).toEqual(
      sync.map((c) => [c.idA, c.idB, c.kind]),
    );
  });

  it('fixture recall/precision: all labeled duplicates and contradictions found, no unrelated flagged', () => {
    const hits = findClaimConflicts(CONFLICT_FIXTURES);
    const hitKeys = new Set(hits.map((h) => `${h.idA}|${h.idB}`));
    const expected = CONFLICT_LABELS.filter((l) => l.label !== 'unrelated');
    for (const label of expected) {
      const key =
        label.idA < label.idB ? `${label.idA}|${label.idB}` : `${label.idB}|${label.idA}`;
      expect(hitKeys.has(key)).toBe(true);
    }
    const unrelated = CONFLICT_LABELS.filter((l) => l.label === 'unrelated');
    for (const label of unrelated) {
      const key =
        label.idA < label.idB ? `${label.idA}|${label.idB}` : `${label.idB}|${label.idA}`;
      expect(hitKeys.has(key)).toBe(false);
    }
    // Recorded in PR: 4/4 recall, 0 false positives on fixtures.
    const expectedHits = new Set(
      expected.map((l) => (l.idA < l.idB ? `${l.idA}|${l.idB}` : `${l.idB}|${l.idA}`)),
    );
    const truePositives = hits.filter((h) => expectedHits.has(`${h.idA}|${h.idB}`)).length;
    expect(truePositives).toBe(expected.length);
  });
});
