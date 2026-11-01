/**
 * Labelled queries over the shipped seed library.
 *
 * Shared by `seed-corpus.test.ts` (concept stand-in) and
 * `model-eval.test.ts` (real embeddings) so the two semantic arms are scored
 * against the *same* labels. If each kept its own copy, a difference between
 * them could come from the questions rather than from the retriever.
 *
 * The labels are authored. That is the honest limit: this is a small
 * human-judged set over real text, not ground truth. It can catch a fusion or
 * ranking regression; it cannot support an absolute quality claim.
 */

import type { LabelledQuery } from './metrics'

export const SEED_QUERIES: readonly LabelledQuery[] = [
  { query: 'who invented TRIZ', relevantIds: ['e2'] },
  { query: 'table of engineering trade offs', relevantIds: ['e1'] },
  { query: 'offline first data ownership', relevantIds: ['e5'] },
  { query: 'note taking second brain', relevantIds: ['e6'] },
  { query: 'nodes and edges diagram', relevantIds: ['e4'] },
  { query: 'group ideation session', relevantIds: ['e7'] },
  { query: 'segmentation principle', relevantIds: ['e3'] },
  { query: 'finding related notes by meaning', relevantIds: ['e8'] },
]
