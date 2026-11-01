/**
 * Memory budget for the in-memory semantic index (Plan 192 split).
 *
 * The index holds document text plus one float vector per document, entirely in
 * memory. On a phone that is the resource that runs out first, so the build
 * checks the estimate before embedding and again after, when the true vector
 * width is known (the model is 384-dimensional, but nothing here hardcodes that
 * as an assumption).
 */

/** Upper bound on approximate semantic-index memory (documents + float vectors). */
export const SEMANTIC_INDEX_MAX_BYTES = 64 * 1024 * 1024

/** Assumed vector width for the pre-embedding budget check when the model is not loaded yet. */
export const ASSUMED_EMBEDDING_DIMENSIONS = 384

let semanticIndexBudgetBytes = SEMANTIC_INDEX_MAX_BYTES

/** The budget currently in force. */
export const getSemanticIndexBudget = (): number => semanticIndexBudgetBytes

/** Override the memory budget for tests (never used by production code). */
export const setSemanticIndexBudgetForTests = (bytes: number): void => {
  semanticIndexBudgetBytes = bytes
}

/** Approximate memory for a corpus at the supplied dimensions. */
export const estimateIndexBytes = (
  docs: readonly { fullText: string }[],
  dimensions: number,
): number => {
  const textBytes = docs.reduce((sum, doc) => sum + doc.fullText.length * 2, 0)
  return textBytes + docs.length * dimensions * 4
}
