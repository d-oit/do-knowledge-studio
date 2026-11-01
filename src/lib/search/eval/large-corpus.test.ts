import { describe, expect, it } from 'vitest'
import { EVAL_K, evaluateStrategy } from './metrics'
import { LARGE_CORPUS, LARGE_QUERIES } from './large-corpus'
import { hybridRankIds, lexicalRankIds } from './strategies'

/**
 * Deterministic checks over the larger fixture corpus.
 *
 * This file owns the properties that must hold with no model involved: the
 * fixture is the size it claims to be, its labels point at documents that
 * exist, and fusion does not cost lexical recall on it. The model-backed arm
 * lives in `model-eval.test.ts`, which is opt-in because it downloads weights.
 *
 * Recall is asserted as an inequality between strategies, never as an absolute
 * score: 16 authored labels over 24 authored documents can catch a regression
 * in ranking or fusion, and cannot support a quality claim.
 */

const lexical = (query: string): readonly string[] =>
  lexicalRankIds(LARGE_CORPUS, [], query, EVAL_K)
const hybrid = (query: string): readonly string[] =>
  hybridRankIds(LARGE_CORPUS, [], query, EVAL_K)

describe('large-corpus retrieval fixture', () => {
  it('is larger than the seed set it complements', () => {
    // Guards the fixture's purpose: if a refactor silently trimmed it back to
    // eight documents, the harness would be back to a saturating set while
    // every other assertion here still passed.
    expect(LARGE_CORPUS.length).toBeGreaterThanOrEqual(20)
    expect(LARGE_QUERIES.length).toBeGreaterThanOrEqual(16)
  })

  it('has unique ids and non-empty document text', () => {
    const ids = LARGE_CORPUS.map((entity) => entity.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entity of LARGE_CORPUS) {
      // Document text is name + description + tags; an empty description would
      // leave the document reachable by name alone and quietly easy.
      expect(entity.description.length, `${entity.id} has no description`).toBeGreaterThan(0)
      expect(entity.tags.length, `${entity.id} has no tags`).toBeGreaterThan(0)
    }
  })

  it('points every label at a document the corpus contains', () => {
    const known = new Set(LARGE_CORPUS.map((entity) => entity.id))
    for (const entry of LARGE_QUERIES) {
      for (const id of entry.relevantIds) {
        expect(known.has(id), `unknown id ${id} for "${entry.query}"`).toBe(true)
      }
    }
  })

  it('includes identifier labels that only lexical retrieval can answer', () => {
    // Identifier queries ("TRIZ-42", "ADR 048") are the counterweight to the
    // paraphrase half: BM25 answers them and an embedding arm has nothing to
    // match. Without them the corpus could not tell a ranking regression from a
    // semantic-arm preference, and the fusion weight sweep would have no case
    // where discounting lexical measurably costs a hit.
    const identifiers = LARGE_QUERIES.filter((entry) =>
      /[A-Z]{2,}[-\s]?\d{2,}/.test(entry.query),
    )
    expect(identifiers.length).toBeGreaterThanOrEqual(3)
    for (const entry of identifiers) {
      expect(
        lexical(entry.query)[0],
        `identifier query "${entry.query}" did not rank its document first`,
      ).toBe(entry.relevantIds[0])
    }
  })

  it('covers both keyword and paraphrase labels', () => {
    // Half the labels share tokens with their document and half avoid them.
    // A set of only paraphrases would make BM25 look broken rather than weak;
    // a set of only keyword queries reproduces the saturation this corpus
    // exists to escape.
    const answeredLexically = LARGE_QUERIES.filter((entry) =>
      lexical(entry.query).some((id) => entry.relevantIds.includes(id)),
    )
    expect(answeredLexically.length).toBeGreaterThan(0)
    expect(answeredLexically.length).toBeLessThan(LARGE_QUERIES.length)
  })

  it('does not lose lexical recall when fusing', () => {
    const lexicalMetrics = evaluateStrategy(LARGE_QUERIES, lexical)
    const hybridMetrics = evaluateStrategy(LARGE_QUERIES, hybrid)
    process.stdout.write(
      `\nlarge-corpus eval (${String(LARGE_QUERIES.length)} labels, ` +
        `${String(LARGE_CORPUS.length)} documents, concept arm)\n` +
        `  lexical   recall@${String(EVAL_K)}=${lexicalMetrics.recallAtK.toFixed(3)} ` +
        `mrr=${lexicalMetrics.mrr.toFixed(3)}\n` +
        `  hybrid    recall@${String(EVAL_K)}=${hybridMetrics.recallAtK.toFixed(3)} ` +
        `mrr=${hybridMetrics.mrr.toFixed(3)}\n`,
    )
    expect(hybridMetrics.recallAtK).toBeGreaterThanOrEqual(lexicalMetrics.recallAtK)
  })
})
