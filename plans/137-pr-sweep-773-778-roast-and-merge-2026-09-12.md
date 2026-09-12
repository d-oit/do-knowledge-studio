# Plan 137 — Open-PR Sweep: Review, Roast, Remediation & Merge Order (2026-09-12)

**Type**: PR sweep execution record (review + roast + remediation)
**Scope**: every open PR at sweep start — **#773**, **#778**
**Skills used**: `static-analysis-suppression` (Codacy/DeepSource triage),
`deepsource` (analyzer inventory), `code-review-assistant` (review pass),
`git-github-workflow` (merge ladder).

## 1. Inventory at sweep start

| PR | Title | Files | Size | Head | State |
|---|---|---|---|---|---|
| #778 | `fix(security): sanitize sourceUrl and escape type fields in exports` | 3 | +84/−14 | `bee78c8` | BLOCKED — Codacy `action_required`, DeepSource JS fail, 7 open threads |
| #773 | `feat(studio): implement open issues N1–N7 …` | 124 | +8364/−1210 | `728fcf8` | BLOCKED — DeepSource JS fail, Vercel fail, 106 threads (72 unresolved) |

`main` head at sweep start: `1bc3dc7` (#777). Only **`Codacy Static Code Analysis`**
is a ruleset-required check (plans/098); DeepSource and Vercel are informational
but were treated as real defects per the AGENTS.md zero-tolerance policy.

## 2. Impact triage — nothing closed

Both PRs carry real, non-duplicated impact, so **no PR was closed**:

- **#778** hardens export output: entity `type` / claim `verification` were
  interpolated into HTML class names and a DOCX hyperlink **unescaped**, and
  `sourceUrl` reached Markdown/HTML/DOCX after only a protocol check. Closing it
  would leave a live injection surface.
- **#773** delivers issues #751–#757 (semantic search, timeline, mentions,
  claim extraction, i18n, offline LLM, entity-type registry) and is the only
  branch containing them — closing it would discard seven merged-ready features.
- Neither branch is a subset of the other: #773 touches `studio`/`search`/`ai`,
  #778 touches `views/export-*` only. **Zero file overlap.**

## 3. Remediation — #773

Commit `4406be8` (thread remediation) + `1a68ac5` (Codacy) on
`feat/open-issues-n1-n7-swarm`:

| Finding | Resolution |
|---|---|
| `semanticSearch` import shadowed by the exported wrapper | import aliased to `vectorStoreSemanticSearch` |
| Abort ignored while the model/runtime was loading | `raceWithAbort` around the lazy load in `send` **and** `stream` |
| Disposed/obsolete embedding load overwriting newer state | `embedderGeneration` guard in `loadEmbedder` |
| Quadratic paren rescans in the claim parser | single right-to-left stack pass (`buildParenMatches`) |
| `z.custom<LucideIcon>()` accepting `{}` | component predicate (`isReactComponentValue`) |
| Reserved `all` sentinel registrable / valid in graph nodes | `RESERVED_TYPE_IDS` + `StoredEntityTypeSchema` on graph nodes |
| Batch commit not redoable as one step | mutate-then-`pushHistory()` ordering |
| Ranking scored another caller's corpus | index re-validated against the request's arrays after query embedding |
| Citation/connection keys colliding on `:` | JSON tuple keys; counts use the deduped list |
| `aria-activedescendant` pointing at a non-rendered option | emitted only when candidates exist |
| Stale semantic outcome shown for a new query | outcome reset at query start; failure keeps the lexical list |
| Semantic results ignoring sort direction | reversed for ascending |
| Empty state rendered over real matches | gated on the filtered set |
| `JS-0357` — `abortError` used before declaration | declaration order restored (**new finding introduced by this push**, fixed before the push landed) |
| `JS-R1005`/`detect-object-injection` on the router tables | `VIEW_NAMES`/`VIEW_ELEMENTS` are `Map`s, `viewEntry` keeps JSX out of the array literal |

## 4. Remediation — #778

Commit `7733a1d` + `1f65ab5` on
`fix/security-export-sanitization-5266046575988275519`:

- `sanitizeExportUrl` = `sanitizeUrl` + `<`/`>` → `%3C`/`%3E`, so a
  scheme-valid but markup-bearing URL cannot inject raw tags into Markdown
  (percent-encoding, not HTML entities, so query strings survive).
- Dropped the `sourceUrl!` non-null assertion (Codacy: forbidden non-null
  assertion) by narrowing the raw value.
- Removed both `any` fixtures (AGENTS.md hard rule + DeepSource), removed the
  script-URL literals CodeQL/DeepSource flag, and upgraded the DOCX test from
  `instanceof Blob` to real OOXML assertions (`fflate` → `word/document.xml`).

## 5. CI outcome

| Check | #778 | #773 |
|---|---|---|
| Codacy (required) | **pass** | **pass** (was `action_required`, fixed by the Map refactor) |
| Build / Unit / E2E / Coverage / Quality Gate / CodeQL / security scans | pass | pass |
| Vercel | pass | **fail — unresolved blocker** |
| DeepSource: JS | **fail — metric-level, no code issue on head** | **fail — complexity notices only** |

### Open items (documented, not ignored)

1. **Vercel fails deterministically for #773 only.** `pnpm run build` is clean
   locally (Next.js 16.2.12 / Turbopack, zero warnings) and Vercel is green for
   #778 and `main`, so the failure is tied to this tree's dependency set
   (`@huggingface/transformers` → `onnxruntime-node`, plus the
   `"onnxruntime-node@1.24.3>adm-zip": "-"` override). Vercel logs require
   credentials (`VERCEL_TOKEN`) that are not available to the agent
   (`npx vercel inspect … --logs` → "No existing credentials found"). **Needs a
   human with Vercel access to read the log before #773 is merged**, because
   merging `#773` deploys `main` to production.
2. **DeepSource: JavaScript** fails on both head commits while `main` is green,
   but on #778's head every posted finding is already `isOutdated` (no blocking
   issue remains) and on #773 the remaining notices are `JS-R1005`
   medium-risk complexity comments plus `JS-0045`, both of which
   `.deepsource.toml` marks `skip = true`. The check is therefore failing at the
   **metric** level, not on code. Follow-up: re-check the DeepSource dashboard
   metric gate (DCV/coverage) configuration; `.deepsource.toml` issue-pattern
   suppressions demonstrably do not clear the status (LESSON-031/034).

### Deferred findings (valid, needs a behavioural change + tests)

GitNexus's review of commit `1a68ac5` raised these; they are **not** fixed here
because each changes search/a11y semantics and deserves its own scoped change:

| Finding | Why deferred |
|---|---|
| `library-view.tsx` — type filter applied *after* semantic truncation (top-100) | Passing the type-filtered corpus into `searchSemantic` fixes it, but changes index-rebuild/perf behaviour for every filter change; needs its own plan + benchmark. |
| `mention.ts` — matcher also matches escaped/code-span mention syntax | Needs Markdown-context awareness (code fences/inline code/escapes) rather than a raw-text regex. |
| `type-selector.tsx` — the entity's current unregistered type has no reachable option (keyboard trap) | Needs an explicit "current type" option plus a11y test coverage. |
| `local-adapter.ts` — a non-streamed fallback reply never reaches `onChunk` | The adapter's contract is deliberate and covered by 7 tests (`chunks` stays empty; the text rides on the returned `ChatResult`). The defect is in the consumer: `use-ai-harness-chat.ts` renders only from `onChunk` and discards the awaited result, so the fix belongs there. |

Also refuted with evidence (threads replied to and resolved): the
`right-panel.tsx` "unused citation index" nit is a false positive — `i` still
renders the citation number (`{i + 1}`).

## 6. Merge order (dependency-driven)

Both PRs are independent, so the order is by risk and size:

1. **#778 first** — 3 files, self-contained security fix, Codacy green, all
   threads resolved, Vercel preview green. Small diffs land first so the larger
   branch rebases onto a shorter delta.
2. **#773 second** — after #778 merges, rebase onto the new `main`; its 124-file
   diff must be re-verified against the changed `main`. **Gate: the Vercel
   blocker in §5.1 must be resolved first.**

## 7. Roast

- **#778** was authored by a robot, reviewed by two robots, and then had to be
  rescued by a third robot because the first robot's tests asserted
  `expect(blob).toBeInstanceOf(Blob)` — the browser equivalent of "I checked
  that the package arrived, I did not open it." It also shipped
  `as any` twice in a repo whose AGENTS.md opens with *no `any`*, and
  `javascript:alert(1)` three times, which static analyzers read as "this
  developer is smuggling eval into the test suite."
- Meanwhile the *actual* security finding — `sanitizeUrl` happily passing
  `https://x/<script>alert(1)</script>` straight into Markdown because it only
  ever checked the protocol — was hiding behind the test lint. The sanitizer
  checked the label on the box, not the box.
- **#773** is 124 files of ambitious, genuinely good work wrapped in a 106-thread
  bot argument. GitNexus re-posted the same fixed findings as *new unresolved
  threads* on every push, DeepSource posted complexity notices for rules it is
  configured to skip, and the PR's own fix for those notices introduced a
  fresh `JS-0357` violation that a later commit then had to fix. The tree is
  the Manhattan of refactors: nothing is broken, but you cannot move a
  function without a bot noticing.
- The single most expensive line in the whole sweep was not code.
  It was `Vercel: Deployment has failed`, followed by an API that answers
  "No existing credentials found." Two CI systems will tell a robot everything
  it got wrong; the one that actually deploys to production tells it nothing.
- Silver lining: the PR that could not deploy is the one with a 106-thread
  audit trail, and the PR that could deploy was hiding `any` in plain sight.
  Neither bot caught its own blind spot; both caught each other's.
