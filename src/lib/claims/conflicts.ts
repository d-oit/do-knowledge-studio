/**
 * Claim conflict detection for #1059.
 *
 * Candidate generation is local-first: lexical Jaccard overlap over
 * `Intl.Segmenter` word tokens (no-AI baseline, runs offline). When a semantic
 * index is available callers may pre-filter pairs by embedding cosine and pass
 * only neighbours here for classification — this module never fetches.
 *
 * Classification:
 * - duplicate: normalized exact match or Jaccard >= threshold.
 * - possible-contradiction: high overlap plus a negation or numeric mismatch.
 *
 * Never auto-modifies claims; all actions are user-confirmed and undoable via
 * the claims slice (`pushHistory`). Flags are suggestions and labelled as such
 * in the UI.
 */
import type { Claim } from '@/lib/studio/types';

/** Pair kind surfaced to the UI. */
export type ConflictKind = 'duplicate' | 'possible-contradiction';

/** One flagged pair. */
export interface ClaimConflict {
  /** First claim id (lexicographically smaller). */
  readonly idA: string;
  /** Second claim id. */
  readonly idB: string;
  readonly kind: ConflictKind;
  /** Jaccard overlap in 0..1. */
  readonly score: number;
  /** Human-readable reason (UI prefixes with suggestion disclaimer). */
  readonly reason: string;
}

/** Jaccard at or above this is a duplicate. */
export const DUPLICATE_JACCARD_THRESHOLD = 0.8;

/** Minimum overlap to consider a contradiction signal. */
export const CONTRADICTION_MIN_OVERLAP = 0.4;

/** Pairs processed before yielding to keep typing responsive. */
export const CONFLICT_YIELD_EVERY_PAIRS = 200;

/** Tokens that flip polarity. */
const NEGATION_TOKENS: ReadonlySet<string> = new Set([
  'not',
  'no',
  'never',
  'none',
  'without',
  "n't",
]);

/** Splits text into lowercase word tokens (i18n-safe segmentation). */
export const tokenizeStatement = (statement: string): string[] => {
  const normalized = statement.toLowerCase().replace(/['’]/g, '');
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    const tokens: string[] = [];
    for (const { segment, isWordLike } of segmenter.segment(normalized)) {
      if (isWordLike === true) tokens.push(segment);
    }
    return tokens;
  } catch {
    return normalized.split(/[^a-z0-9]+/u).filter((t) => t.length > 0);
  }
};

/** Jaccard similarity over token multisets (0..1). */
export const jaccardSimilarity = (a: readonly string[], b: readonly string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of a) counts.set(t, (counts.get(t) ?? 0) + 1);
  let intersection = 0;
  for (const t of b) {
    const remaining = counts.get(t) ?? 0;
    if (remaining > 0) {
      intersection += 1;
      counts.set(t, remaining - 1);
    }
  }
  const union = a.length + b.length - intersection;
  return union === 0 ? 0 : intersection / union;
};

/** Numeric literals in a statement (normalized). */
export const extractNumbers = (statement: string): string[] => {
  const matches = statement.match(/-?\d+(?:\.\d+)?/g);
  return matches ?? [];
};

/** True when exactly one side carries negation language. */
export const hasNegationDifference = (a: readonly string[], b: readonly string[]): boolean => {
  const aNeg = a.some((t) => NEGATION_TOKENS.has(t) || t.endsWith("n't"));
  const bNeg = b.some((t) => NEGATION_TOKENS.has(t) || t.endsWith("n't"));
  return aNeg !== bNeg;
};

/** True when same context but different numbers (e.g. dates, counts). */
export const hasNumericMismatch = (aStatement: string, bStatement: string): boolean => {
  const aNums = extractNumbers(aStatement);
  const bNums = extractNumbers(bStatement);
  if (aNums.length === 0 || bNums.length === 0) return false;
  if (aNums.length !== bNums.length) return true;
  return aNums.some((n, i) => n !== bNums[i]);
};

/** Deterministic pair key (order-independent). */
export const conflictPairKey = (idA: string, idB: string): string =>
  idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;

/** Classifies one pair; returns null when unrelated. */
export const classifyPair = (a: Claim, b: Claim): ClaimConflict | null => {
  if (a.id === b.id) return null;
  const aTokens = tokenizeStatement(a.statement);
  const bTokens = tokenizeStatement(b.statement);
  const score = jaccardSimilarity(aTokens, bTokens);
  const [idA, idB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];

  const normalizedA = a.statement.trim().toLowerCase();
  const normalizedB = b.statement.trim().toLowerCase();
  if (normalizedA === normalizedB) {
    return { idA, idB, kind: 'duplicate', score: 1, reason: 'Identical statements' };
  }
  // Contradiction signals win over near-duplicate wording: a negation or a
  // numeric mismatch with high overlap is not a duplicate.
  if (score >= CONTRADICTION_MIN_OVERLAP) {
    if (hasNegationDifference(aTokens, bTokens)) {
      return { idA, idB, kind: 'possible-contradiction', score, reason: 'Same topic, opposite polarity' };
    }
    if (hasNumericMismatch(a.statement, b.statement)) {
      return { idA, idB, kind: 'possible-contradiction', score, reason: 'Same topic, different numbers' };
    }
  }
  if (score >= DUPLICATE_JACCARD_THRESHOLD) {
    return { idA, idB, kind: 'duplicate', score, reason: 'Near-identical wording' };
  }
  return null;
};

/** Synchronous pairwise scan (fine for a few hundred claims). */
export const findClaimConflicts = (claims: readonly Claim[]): ClaimConflict[] => {
  const out: ClaimConflict[] = [];
  for (let i = 0; i < claims.length; i += 1) {
    const a = claims[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < claims.length; j += 1) {
      const b = claims[j];
      if (b === undefined) continue;
      const hit = classifyPair(a, b);
      if (hit !== null) out.push(hit);
    }
  }
  return out.sort((x, y) => y.score - x.score);
};

/**
 * Cooperative scan that yields every `CONFLICT_YIELD_EVERY_PAIRS` pairs so
 * typing never blocks (plan 187 pattern). Resolves with the same ordering as
 * {@link findClaimConflicts}.
 */
export const findClaimConflictsAsync = async (claims: readonly Claim[]): Promise<ClaimConflict[]> => {
  const out: ClaimConflict[] = [];
  let sinceYield = 0;
  for (let i = 0; i < claims.length; i += 1) {
    const a = claims[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < claims.length; j += 1) {
      const b = claims[j];
      if (b === undefined) continue;
      const hit = classifyPair(a, b);
      if (hit !== null) out.push(hit);
      sinceYield += 1;
      if (sinceYield >= CONFLICT_YIELD_EVERY_PAIRS) {
        sinceYield = 0;
        await new Promise<void>((resolve) => {
          queueMicrotask(() => resolve());
        });
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
};
