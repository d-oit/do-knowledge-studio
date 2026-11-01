# Retrieval label authoring guide

Reference for `#1065`. The retrieval harnesses in `src/lib/search/eval/` are only
as good as their labels, and every label set in this repository was written by
the person who wrote the retrievers. This guide exists so someone else can add
an independent set without needing to know how ranking works.

## What a label is

A label is one `LabelledQuery`: a search string a real user might type, plus the
document ids that should come back.

```ts
{ query: 'how do I keep working without a signal', relevantIds: ['e5'] }
```

Two numbers are computed from it, and nothing else:

- **recall@5** — what fraction of `relevantIds` appears in the first five results.
- **MRR** — `1 / position` of the first relevant result, or 0 if none is in the list.

So a label only needs to answer one question: *if I type this, which document do
I expect?* If several documents are genuinely correct, list all of them.

## The one rule that matters

**Write the query before you look at the retriever, and do not read the ranking
first.** Open the target document, read its text, close everything else, and
type what you would actually type. If you check the current results first, you
will write queries the current code already answers — which measures the code
you just read, not retrieval quality.

Corollary: do not tune a query until it works. A label you had to fix is a label
about your reading of the ranking.

## What the sets need

A set made only of paraphrases makes keyword search look broken. A set made only
of keywords cannot show whether meaning-based search helps. Every set here has
three shapes, roughly in equal measure:

| Shape | Example | Why it is there |
| --- | --- | --- |
| Shared vocabulary | `stemming tokens to a root` | The case keyword search is built for; anchors the set. |
| Paraphrase | `splitting one large part into several smaller ones` | No distinctive nouns copied from the document. This is where a semantic arm can win. |
| Identifier | `TRIZ-42`, `ADR 048` | Codes, issue keys, spec numbers. Only exact-token search answers these, so they catch a fusion step that discounts keywords too far. |

Also worth adding, if the corpus has them: short queries (one or two words),
queries with a typo, and queries that should return **nothing** — those last ones
are recorded in a separate list, because recall and MRR cannot express "correctly
empty".

## Worked example

Corpus document:

```ts
['lc-26', 'ADR 048 at-rest encryption', 'Decision record for passphrase-protected storage', 'security adr']
```

Three labels from it, written independently:

```ts
// shared vocabulary
{ query: 'at-rest encryption decision', relevantIds: ['lc-26'] }
// paraphrase: the same intent, none of the document's nouns
{ query: 'protecting stored notes with a password', relevantIds: ['lc-26'] }
// identifier: the code as a user would paste it
{ query: 'ADR 048', relevantIds: ['lc-26'] }
```

Note what the paraphrase avoids: "encryption", "passphrase", "storage". If it
reused them, it would be a keyword query wearing a different sentence structure.

## Checklist before opening a PR

- [ ] Every `relevantIds` value exists in the corpus. The harnesses assert this,
      because a typo otherwise lowers recall while looking like a ranking bug.
- [ ] No two labels are the same query string.
- [ ] The set contains all three shapes above, with at least three identifiers
      if the corpus has identifier-bearing documents.
- [ ] Each label was written from the document text alone, without reading the
      current results.
- [ ] The number of labels is honest in the PR body — ten labels over twenty
      documents is a smoke test, not a benchmark.

## Running the harnesses

```bash
# Deterministic: keyword arm, concept stand-in, fusion. Runs in CI.
pnpm exec vitest run src/lib/search/eval

# Model-backed: downloads ~25 MB of ONNX weights, needs RUN_MODEL_EVAL=1.
RUN_MODEL_EVAL=1 pnpm exec vitest run src/lib/search/eval/model-eval.test.ts

# In the shipped browser pipeline (production build, worker, WASM):
PLAYWRIGHT_PRODUCTION=1 pnpm exec playwright test e2e/semantic-search-eval.spec.ts --project=chromium
```

Print the numbers into the PR body. If a change lowers recall, say by how much
and on which shape of label — an average over the whole set hides exactly the
regression worth knowing about.

## Honest limits, stated up front

- These labels are authored, not ground truth. They catch regressions and
  direction; they do not support an absolute quality claim.
- Small corpora saturate. Eight documents with one obvious target per query will
  score 1.000 for any competent retriever — that is a property of the corpus, not
  evidence.
- If you wrote the retriever, your labels are not independent. Say so in the PR.
  Reviewers should weight a set written by someone else more heavily, and the
  harness comments should keep saying which is which.
