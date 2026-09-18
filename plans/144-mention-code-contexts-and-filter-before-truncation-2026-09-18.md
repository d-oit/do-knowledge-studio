# Plan 144 — Remaining plans/137 §5 Findings: Mention Code Contexts + Type Filter Before Truncation (2026-09-18)

**Type**: defect fixes (editor linking, library search) + benchmark
**Scope**: `mention.ts`, `retrieval.ts`, `vector-store.ts`, `search-worker-client.ts`, `library-view.tsx` + 4 test files
**Follows**: plans/137 §5, plans/142 §5.2

Both findings were raised by the GitNexus review of `1a68ac5` and deferred with
reasons ("needs Markdown-context awareness", "needs its own plan + benchmark").
This plan is that plan.

## 1. Mentions matched inside code and escaped syntax

`findMentionTokens` ran `MENTION_TOKEN_PATTERN` over the raw content, so a token
that Markdown renders as *literal text* still created links and backlinks:

| Written as | Rendered as | Old behaviour |
|---|---|---|
| ```` ```md [@Alice](dks://entity/e1) ``` ```` | code block | created a real link + reciprocal backlink |
| `` `[@Alice](dks://entity/e1)` `` | inline code | same |
| `\[@Alice](dks://entity/e1)` | escaped literal | same |

The failure mode is concrete: documenting the token syntax inside a code fence
(which `mention.ts`'s own header does) silently links the document to that
entity.

**Fix** — `findMentionTokens` now skips tokens that start inside a Markdown code
range or whose opening `[` is escaped:

- `collectFenceRanges` — fenced blocks (``` ``` ``` / `~~~`, 3+ chars, up to 3
  spaces of indent, closing run must match char and length). An unclosed fence
  runs to the end of the content.
- `collectInlineCodeRanges` — code spans delimited by backtick runs; a span
  closes on the next run of *exactly* the same length (CommonMark). Runs already
  inside a fence are skipped. An unmatched opening run is literal text.
- `isEscaped` — odd backslash run before the token start means the bracket is
  escaped (`\\[@…` is a literal backslash plus a real token).

`getMentionTrigger` is gated the same way: a `@` typed inside code never becomes
a link, so the picker stays closed instead of inserting an inert token. The
caret test looks at the character it *follows* (`caret - 1`), which keeps a
caret at the end of an unclosed fence inside the region.

Deliberate approximation, documented on `collectFenceRanges`: every miss errs
toward treating content as code, so the failure mode is a missed link, never a
link the renderer shows as literal text.

## 2. Type filter applied after semantic truncation

`useSemanticSearch` asked for the top-100 documents of the **whole** corpus, and
`resolveSemanticEntities` filtered by type afterwards. With more than 100
matches, a filtered view could show nothing even though matching entities
existed below the cut.

**Chosen fix: a filter predicate inside the search, not a filtered corpus.**
The vector store already had `SemanticDocFilter` and applied it in `scoreAll`
before sorting and slicing — the view simply never used it. Passing a filtered
corpus instead (the option plans/137 sketched) would have changed the index
cache key, forcing a full re-embed of the filtered subset on **every** type
filter change.

- `retrieval.ts` gains the shared `FilterableDoc` shape and `SearchFilter`;
  `IndexEntry` carries `entityType`; `search()` takes an optional filter and
  narrows candidates before IDF/length stats, ranking, and `limit`.
- `vector-store.ts`: `SemanticDoc` carries `entityType` (for entities and for
  their claims), `semanticSearch` takes the filter and passes it to both the
  vector ranking and the lexical fallback.
- `search-worker-client.ts` forwards the filter (static + standalone helper).
- `library-view.tsx` builds the predicate from the active type filter and adds
  `typeFilter` to the effect deps, so changing the filter re-ranks **within**
  the new set instead of re-filtering the previous unfiltered ranking.
  `resolveSemanticEntities` keeps its post-filter as a cheap correctness net.

The corpus is untouched, so the cached index and its embeddings are reused
across filter changes (asserted by a test).

### Benchmark (the plans/137 §5 requirement)

Median of 25 runs after 3 warm-ups, temp harness deleted after the run
(`Intl.Segmenter`-based BM25, 2000 entities / limit 100; vector scan over 5000
docs × 384 dims / limit 100, 1-in-4 docs passing the filter):

| Engine | Unfiltered | Filtered | Delta |
|---|---|---|---|
| BM25 | 61.53 ms | 55.06 ms | **−10.5%** |
| Vector | 5.64 ms | 1.39 ms | **−75.4%** |

The filter is a net win: excluded documents skip scoring entirely, and the
statistics recomputed over the filtered set are O(n) against a full BM25 score
per document. No index rebuild is involved.

## 3. Verification

| Check | Result |
|---|---|
| `vitest run` (mention) | 42 passed (9 new) |
| `vitest run` (retrieval / vector-store / library-view) | 72 passed (7 new) |
| Both fixes stashed | 8 of the 9 mention tests + 6 of the 7 search tests fail with the expected assertions (`expected [ 'concept-1' ] to deeply equal [ 'note-1' ]`, `expected [ 'e1', 'e2' ] to deeply equal [ 'e2' ]`, `expected undefined to be true`); the two that still pass are deliberate non-regression guards (a trigger right after a closed span, and index reuse without a filter) |
| `pnpm run lint` | clean, 0 warnings |
| `pnpm run typecheck` | clean |
| `pnpm test` | 169 files, 2604 passed / 1 skipped |
| `pnpm run build` | clean (the `useTypeScriptCli` notice is pre-existing — plans/142 §4) |
| `./scripts/quality_gate.sh` | ✓ all gates passed, 0 warnings |

## 4. ADR check

No ADR needed. §1 makes an existing contract hold (only *link-creating* tokens
create links) and §2 moves a filter to where ranking happens; neither changes
storage, export, agent workflow, or cross-cutting infrastructure. Search
behaviour does change — the type filter now narrows the ranked set — which is
the documented intent of the `typeFilter` control and is covered here.

## 5. Follow-ups

- DeepSource quota (plans/141 §1) — account-level, needs the maintainer.
- ESLint 10 (plans/140 §2) — blocked upstream.
