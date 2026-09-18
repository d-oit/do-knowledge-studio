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
range or whose opening `[` is escaped. Code ranges come from **the preview's own
Markdown pipeline** rather than a hand-rolled scanner:

```ts
const markdownProcessor = unified().use(remarkParse).use(remarkGfm)
```

`collectCodeRanges` walks the mdast tree collecting the source range of every
`code` (fenced **and** indented) and `inlineCode` node, so mention matching
agrees with what `react-markdown` renders by construction — including escaped
backticks, invalid fence info strings, and code spans that must not close on a
fence delimiter. `isEscaped` still guards the token's opening bracket (odd
backslash run), and `getMentionTrigger` is gated the same way: a `@` typed
inside code never becomes a link, so the picker stays closed instead of
inserting an inert token (the caret test looks at the character it *follows*,
`caret - 1`, which keeps a caret at the end of an unclosed fence inside the
region).

A first implementation hand-rolled the CommonMark rules; review findings
(GitNexus, PR #795) showed each remaining gap — indented code blocks, escaped
backticks, backtick fences whose info string contains a backtick, a fence
delimiter closing an inline span — was another hand-written rule. Parsing with
the renderer's pipeline removes the class instead of the instances.

`unified` and `remark-parse` were added as direct dependencies (`remark-gfm`
already was); all three were already in the client bundle via `react-markdown`,
so no new download or bundle weight.

### Hot-path cost

`getMentionTrigger` runs on every keystroke, so the parse is guarded and cached
(median of 21 cold calls — unique content each call, so the cache never hits):

| Path | Cost |
|---|---|
| Save / scan, prose-only 5.8 KB | 0.012 ms |
| Save / scan, 5.8 KB containing code | 7.2 ms |
| Save / scan, 58 KB containing code | 64.7 ms |
| Caret move, prose-only | 0.013 ms |
| Caret + `@` typing, prose-only | 0.011 ms |
| Caret + `@` typing, 5.8 KB containing code | 6.9 ms |

Two guards keep the parser off the common path: `MAY_CONTAIN_CODE_PATTERN`
(no backtick, tilde, or 4-space indent ⇒ no code ⇒ no parse), and the trigger
checks for a valid `@` query **before** the code check, so ordinary typing never
parses. Only typing a mention inside a document that actually contains code pays
the parse (≈7 ms per keystroke at 5.8 KB); the save path pays it once.

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

### File-size compliance

`library-view.tsx` was 613 LOC before this change — already over the 500 LOC
hard limit, and this change would have extended it further. The semantic-search
concerns this change touches (the hook, the type-filter builder, the result
resolver, and the status banner) moved verbatim to
`library-semantic-search.tsx` (172 LOC), bringing the view to **468 LOC**. No
behaviour change: the view's tests pass unchanged.

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

- **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
  Re-checked 2026-09-18: no DeepSource check run is posted on the recent PR
  heads (#793/#794/#795) and no `DEEPSOURCE_TOKEN` exists locally, so the
  service state cannot be queried from the repository. Nothing actionable here.
- **ESLint 10** (plans/140 §2) — blocked upstream. Re-checked 2026-09-18:
  `eslint-plugin-react` latest is still `7.37.5` with a `^9.7` peer ceiling,
  `eslint` latest is `10.10.0` while the `9.39.5` maintenance line is
  deprecated. Revisit condition unchanged.
