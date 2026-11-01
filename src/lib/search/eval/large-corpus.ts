/**
 * A larger labelled corpus for the retrieval harness (Issue #1065).
 *
 * The seed library is eight documents. Every harness that scores it is one
 * paraphrase label away from saturation, and eight documents cannot show
 * whether a retriever's advantage survives scale. This corpus is 24 documents
 * across the studio's own subsystems, which gives each query several plausible
 * distractors instead of one obvious target.
 *
 * How the labels were written, because it bounds what they prove: each label
 * was written from its target document's text alone, before running any
 * retriever, and the paraphrase half deliberately avoids the document's
 * distinctive nouns. They were not written by someone independent of this code,
 * and 24 authored documents are not a benchmark. Treat the numbers as a
 * regression signal that is harder to accidentally satisfy than the seed set.
 *
 * Documents carry no `content`: document text is name + description + tags,
 * which is what `vector-store.ts` embeds for an entity, so the two arms see the
 * same input.
 */

import type { Entity } from '@/lib/studio/types'
import type { LabelledQuery } from './metrics'

/** Compact authoring row: id, name, description, tags. */
type CorpusRow = readonly [id: string, name: string, description: string, tags: string]

const AUTHORED_AT = '2026-01-01T00:00:00.000Z'

const ROWS: readonly CorpusRow[] = [
  ['lc-01', 'Hybrid rank fusion', 'Merges two ranked lists by reciprocal rank', 'search fusion'],
  ['lc-02', 'Vector index budget', 'Memory ceiling for stored embeddings', 'search memory'],
  ['lc-03', 'Worker thread search', 'Runs retrieval off the main thread', 'search performance'],
  ['lc-04', 'Tokenisation stemmer', 'Reduces words to shared stems', 'search text'],
  ['lc-05', 'Contradiction triage', 'Separates improving and worsening parameters', 'triz method'],
  ['lc-06', 'Ideal final result', 'Describes the outcome with no added cost', 'triz'],
  ['lc-07', 'Resource inventory', 'Lists available substances and fields', 'triz'],
  ['lc-08', 'Peer mesh transport', 'Direct browser-to-browser channels', 'sync webrtc'],
  ['lc-09', 'Conflict quarantine', 'Holds divergent edits for review', 'sync merge'],
  ['lc-10', 'Tombstone ledger', 'Records deletions so peers agree', 'sync'],
  ['lc-11', 'Encrypted archive', 'Password-protected export bundle', 'export security'],
  ['lc-12', 'Markdown export', 'Human-readable plain text bundle', 'export'],
  ['lc-13', 'Backup integrity check', 'Verifies a digest before restore', 'export'],
  ['lc-14', 'Rich text editor', 'Formats text with inline marks', 'editor'],
  ['lc-15', 'Draft autosave', 'Persists unsent text locally', 'editor'],
  ['lc-16', 'Mention picker', 'Links entities while typing', 'editor'],
  ['lc-17', 'Force layout graph', 'Positions nodes by simulated springs', 'graph'],
  ['lc-18', 'Mind map branch', 'Nested idea tree beside a note', 'mindmap'],
  ['lc-19', 'Command palette', 'Keyboard launcher for every action', 'ui'],
  ['lc-20', 'Announcer region', 'Screen reader status channel', 'a11y'],
  ['lc-21', 'Theme tokens', 'Colour and spacing variables', 'ui design'],
  ['lc-22', 'Service worker shell', 'Offline app cache', 'pwa'],
  ['lc-23', 'At rest encryption', 'Protects stored data with a passphrase', 'security'],
  ['lc-24', 'Precache manifest', 'Lists assets the shell needs offline', 'pwa build'],
]

/** 24 documents across the studio's subsystems, used as a retrieval fixture. */
export const LARGE_CORPUS: readonly Entity[] = ROWS.map(
  ([id, name, description, tags]): Entity => ({
    id,
    name,
    description,
    content: '',
    type: 'note',
    tags: tags.split(' '),
    createdAt: AUTHORED_AT,
    updatedAt: AUTHORED_AT,
    links: [],
  }),
)

/**
 * 16 labels: 8 that share vocabulary with their document, 8 paraphrases that
 * avoid it. Both halves matter — a set of only paraphrases would make BM25 look
 * broken rather than weak, and a set of only keyword queries would reproduce
 * the saturation this corpus exists to escape.
 */
export const LARGE_QUERIES: readonly LabelledQuery[] = [
  // Sentence-shaped restatements of the document's own wording.
  { query: 'reciprocal rank fusion', relevantIds: ['lc-01'] },
  { query: 'vector index memory ceiling', relevantIds: ['lc-02'] },
  { query: 'off main thread retrieval', relevantIds: ['lc-03'] },
  { query: 'stemming tokens to a root', relevantIds: ['lc-04'] },
  { query: 'worsening parameter', relevantIds: ['lc-05'] },
  { query: 'webrtc peer channels', relevantIds: ['lc-08'] },
  { query: 'password protected export bundle', relevantIds: ['lc-11'] },
  { query: 'screen reader status channel', relevantIds: ['lc-20'] },
  // Paraphrases: the same intent without the document's distinctive nouns.
  { query: 'combining two rankings of the same results', relevantIds: ['lc-01'] },
  { query: 'how much memory embeddings may occupy', relevantIds: ['lc-02'] },
  { query: 'keeping the interface responsive while querying', relevantIds: ['lc-03'] },
  { query: 'matching words that share a root', relevantIds: ['lc-04'] },
  { query: 'what gets better and what gets worse', relevantIds: ['lc-05'] },
  { query: 'browsers talking directly to each other', relevantIds: ['lc-08'] },
  { query: 'locking an export with a passphrase', relevantIds: ['lc-11'] },
  { query: 'a status channel for assistive technology', relevantIds: ['lc-20'] },
]
