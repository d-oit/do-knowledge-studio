# Plan 139 — Deferred N1–N7 Review Findings (2026-09-13)

**Type**: implementation track
**Scope**: the four deferred findings from plans/137 §5
**Follows**: plans/137 (PR sweep), plans/138 (production deploy fix)

## 1. Context

plans/137/§5 recorded four GitNexus review findings against the N1–N7 sprint
tree. They were deferred rather than ignored because each changes
search/a11y semantics and needs its own scoped change plus tests. All four are
addressed here, together with the 500-LOC violation that the sprint merge
introduced in `library-view.tsx`.

## 2. Findings and fixes

### 2.1 Semantic type filter was applied *after* truncation

**File**: `library-view.tsx` (was `useSemanticSearch(...)` corpus args)

`searchSemantic` truncates to `SEMANTIC_RESULT_LIMIT` (100). The type filter was
applied to the *returned* hits, so every entity of the wanted type that ranked
outside the global top-100 was discarded — worst case a type filter rendering
nothing at all despite matches existing.

The corpus is now narrowed **before** the query, in a pure helper
`narrowSemanticCorpus(entities, claims, typeFilter)`; claims are scoped to the
same corpus so a claim can never pull in a filtered-out entity. The
index-rebuild cost on filter change is accepted and documented in the helper.

### 2.2 Mention matcher matched escaped / code-span syntax

**File**: `src/lib/editor/mention.ts`

`findMentionTokens` is a raw-text regex, so a token-shaped string inside a
fenced code block, inside an inline code span, or backslash-escaped was treated
as a live mention — creating links and backlinks from documentation.

Added Markdown-context awareness:

| Helper | Responsibility |
|---|---|
| `findFencedCodeRanges` | `` ``` ``/`~~~` fenced blocks (3+ delimiters, equal-or-longer closer, unterminated fence extends to EOF) |
| `findInlineCodeRanges` | inline spans paired by equal backtick-run length, skipping runs inside fences |
| `isEscapedToken` | odd-run backslash escape before the token |

Literal tokens are skipped everywhere: `findMentionTokens`, link derivation,
and `removeMentionTokens`.

### 2.3 Type selector could trap keyboard users

**File**: `src/components/studio/views/type-selector.tsx`

An entity whose stored type is no longer registered (custom type removed or
renamed, or imported content) produced a listbox with **no** option carrying
`tabindex="0"` — the arrow-key cursor had nothing to land on. The options list
is now built explicitly: when the current type is unregistered, an extra
`"<label> (current)"` option is prepended, marked `aria-selected` and focusable,
above the registered types. Registered options stay selectable.

### 2.4 Local-adapter reply was discarded by the consumer

**File**: `src/components/studio/views/use-ai-harness-chat.ts`

The local (in-browser) adapter has no streaming path: it never calls `onChunk`
and returns the reply on the resolved `ChatResult`. The consumer rendered only
from `onChunk`, so the assistant bubble stayed empty. The consumer now renders
`result.content` when nothing was streamed (`renderAssistantReply`).

The adapter contract is **unchanged** — it is deliberate and covered by 7 tests
(`chunks` stays empty, text rides on `ChatResult`). A previous attempt to change
the adapter itself contradicted those tests and was reverted in favour of this
consumer-side fix, exactly as plans/137 predicted.

## 3. Structural fix — 500-LOC limit

`library-view.tsx` was **612 lines on `main`** (introduced by the #773 merge)
and the corpus change pushed it to 629, violating the AGENTS.md 500-LOC rule
("refactor before extending oversized files").

Extracted `src/components/studio/views/library-semantic-search.tsx` (176 lines)
holding `useSemanticSearch`, `passesTypeFilter`, `narrowSemanticCorpus`,
`resolveSemanticEntities`, and `SemanticStatusBanner`.

Result: `library-view.tsx` **612 → 475 lines** (under the limit), no external
consumer of the moved symbols existed (only `LibraryView` is imported elsewhere),
so the extraction is a pure move plus the §2.1 behaviour change.

## 4. Verification

| Check | Result |
|---|---|
| `pnpm run lint` | clean, exit 0 |
| `pnpm run typecheck` | clean, exit 0 |
| `pnpm run test` | 169 files, **2599 passed / 1 skipped**, no type errors |
| `pnpm run build` (Next.js 16.2.12 / Turbopack) | clean, 0 warnings, 4/4 pages |
| `wc -l library-view.tsx` | 475 (was 612) |

New tests:

- `library-semantic-search.test.ts` — 11 unit tests for `passesTypeFilter`,
  `narrowSemanticCorpus` (incl. claim scoping and the empty-type case), and
  `resolveSemanticEntities` (rank order, claim→entity resolution, dedupe, type
  filter, unresolvable ids).
- `library-view.test.tsx` — end-to-end assertion that the corpus passed to
  `searchSemantic` is type-narrowed before the query.
- `mention.test.ts` — 8 tests covering fenced (``` / `~~~` / unterminated),
  inline-span, and backslash-escape contexts, plus a live token beside a literal
  one, link derivation, and `removeMentionTokens`.
- `type-selector.test.tsx` — unregistered-current-type option is focusable,
  `aria-selected`, and registered types remain selectable.
- `ai-harness-view-coverage.test.tsx` — a non-streamed provider reply renders.

**Pre-existing defect exposed by the new library test**: the `library-view`
store mock never supplied `claims`, so `claims.filter(...)` threw. The mock now
provides `claims` (defaulting to `[]`). This was a fixture gap, not a product
bug.

## 5. Review round on PR #781

The PR review raised 7 findings. All were valid and are fixed in the same PR:

| Finding | Verdict | Fix |
|---|---|---|
| **`getMentionTrigger` could open the picker inside code** — `findMentionTokens` was its only guard, so once literal tokens were filtered out, an `@query` inside a code span/fence read as live and Enter would rewrite documentation into a link | **Real regression from this change** | `getMentionTrigger` is now literal-aware: blocked when the caret is in a literal range, and the backward `@` scan (`findMentionAt`) skips `@`s inside literal ranges too. Also fixes the pre-existing incomplete-`@query`-in-code-span case. |
| `findFencedCodeRanges` cyclomatic complexity 9 (JS-R1005) | Real | Extracted `toOpenFence` / `closesFence`; loop body is now flat — complexity 5 |
| `void` operand in the extracted hook (JS-0240-style) | Real | Replaced the `void`-ed async IIFE with a `.then()/.catch()` chain plus `applyOutcome`; `AbortController` + `cancelled` semantics preserved, complexity of the effect callback 6 → 3 |
| The non-streamed regression test did not actually select the local provider (it exercised OpenRouter) | Real | Added `local` to the mocked `PROVIDERS`/`DEFAULT_MODEL` and drives the real provider `<select>`; the test now also asserts the request carried `provider: 'local'` |
| `async` arrow with no `await` in the new test | Real | Added the awaited microtask flush the surrounding tests already use |
| The comment claimed the local adapter “never calls `onChunk`” | Real doc defect | Corrected: the adapter streams via `TextStreamer`, and `runGeneration` returns the complete text when no fragment was emitted |
| `library-semantic-search.tsx` complexity 6 on the effect | Real | Same restructure as the `void` fix |

New tests for the trigger behaviour: inactive inside an inline code span, inside a
fenced block, just after a complete token in a code span, and after a code span
containing `@`; still active in ordinary prose and in prose following a code span.

### Second review round (same PR)

| Finding | Verdict | Fix |
|---|---|---|
| `findFencedCodeRanges` still complexity 6 | Real | Split into `findFenceLines` (complexity 3) + `closesFence` + a loop-only pairing function (complexity 5) |
| **Escaped complete tokens were not blocked in `getMentionTrigger`** — `scanMentionTokens` omits them from `tokens`, and the literal ranges only covered code, so the picker still opened inside `\[@Alice\](…)` | **Real** | The scan now returns `literalRanges` **including every escaped token's range**, not just code ranges, so the caret and the backward `@` scan are both blocked |
| A backtick fence whose info string contains a backtick was treated as a fence | Real | `toFenceLine` rejects it (CommonMark: only backtick fences forbid a backtick in the info string) |

Two further tests: the escaped-token case sweeps **every** caret position and first
asserts the token is present verbatim but not live (the assertion caught that the
first version of this test was silently testing a literal `${token}` string), and
`\`\`\`md\`x` is asserted to be prose so a token below it stays live.

## 6. Remaining follow-ups (documented, not ignored)

1. **Top-level `package.json` `overrides` are inert under pnpm** (plans/138
   §5.1). All 17 entries — including the security-relevant `undici`,
   `dompurify`, `prismjs`, `diff`, `js-yaml`, `nanoid@3` pins — are silently not
   enforced by `pnpm@10.30.3`; they only persist because an older lockfile baked
   the resolutions in. Moving them to `pnpm.overrides` needs its own plan plus a
   dependency security re-scan, because it changes resolved versions.
2. **`Ignored build scripts: onnxruntime-node@1.24.3`** (plans/138 §5.2). pnpm
   10 blocks dependency build scripts by default. Harmless for the browser
   bundle (`onnxruntime-node` is the Node path, unreachable from the WASM
   client), but the `onlyBuiltDependencies` allowlist decision should be
   recorded.
3. **`DeepSource: JavaScript` metric gate** (plans/137 §5.2). Still fails at the
   metric level while every posted finding is `isOutdated` or `skip = true` in
   `.deepsource.toml`. Not a ruleset-required check.
