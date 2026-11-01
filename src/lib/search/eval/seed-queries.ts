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
  // Second block: paraphrases of the same eight documents, added because the
  // original eight saturated at recall 1.000 for BM25 and therefore could not
  // show whether a semantic arm helps. Each one asks for a document without
  // reusing its distinctive vocabulary ("trade-offs" for contradiction,
  // "diagram" for graph, "network connection" for offline). They were written
  // for lexical *mismatch*, not for what the model is known to get right — a
  // label chosen because the retriever already succeeds measures the label.
  // Authored, so still not ground truth: the numbers are a regression signal.
  { query: 'method for resolving competing design requirements', relevantIds: ['e1'] },
  { query: 'the person behind the invention framework', relevantIds: ['e2'] },
  { query: 'splitting one large part into several smaller ones', relevantIds: ['e3'] },
  { query: 'working without a network connection', relevantIds: ['e5'] },
  { query: 'collecting material without ever revisiting it', relevantIds: ['e6'] },
  { query: 'generating ideas with no guiding method', relevantIds: ['e7'] },
  { query: 'finding passages that mean the same but share no words', relevantIds: ['e8'] },
  { query: 'a diagram of how concepts connect', relevantIds: ['e4'] },
]
