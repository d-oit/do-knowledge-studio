# Plan 176 — plans/ Backlog Drain: the ADR 035 Error/Logging Stack and Recorded Follow-ups

**Date:** 2026-10-17
**Status:** Done — merged in [PR #990](https://github.com/d-oit/do-knowledge-studio/pull/990)
at `4294126` (squash). Every check on the PR passed, Codacy reported 0 issues,
and the production deployment succeeded: the live
`https://do-knowledge-studio.vercel.app/manifest.webmanifest` serves the four
new shortcuts, which is the merged build's own fingerprint.
**Method:** GOAP (recon swarm of four scanners → source-verified inventory →
wave-wise execution with one owner per file set → orchestrator-run gates),
official docs consulted in-repo (`node_modules/next/dist/docs/`) and on the web
(Next.js App Router error files, W3C Web App Manifest `shortcuts`).
**Related:** [ADR 035](ADRs/035-global-error-handling-and-client-side-logging.md),
[ADR 036](ADRs/036-e2e-responsive-test-matrix.md), Plan 130 (G1), Plans
131/151/152/153/157/158/163/164/165/166/167/168/169, Plans 169/170, Plan 175,
[ADR 037](ADRs/037-url-addressable-view-state.md).

## Task Analysis (GOAP Phase 1)

**Primary goal:** implement every *recorded, committed* open item in `plans/` in a
single PR, and reconcile the records that source already satisfies.

**Method:** four read-only scanners swept the folder by range (`plans/150–162`,
`163–166`, `167–175` + every ADR, and a whole-folder sweep of unchecked boxes,
TODO markers and "remains open" prose). Every candidate was then re-checked
against current source with `file:line` evidence. GitHub was clean at the start:
0 open issues, 0 open PRs, 0 open Dependabot alerts (2026-10-17).

**Scope rule (recorded so the boundary stays auditable):**

- **In scope** — a recorded ask whose *work* is outstanding ("missing
  implementation", "deferred", "follow-up", "remains open", "left open",
  "unbuilt"), plus ledger rows a reconciliation still lists as open.
- **Out of scope (parked candidates, not tasks)** — asks whose *decision* the
  record says is missing, or that are conditioned on the retired architecture or
  an upstream release. Each is quoted under "Excluded" below.

## Verified Inventory

| # | Item | Source record | Wave |
| --- | --- | --- | --- |
| 1 | Global error handling + structured logging (ADR 035 A1–A6) | ADR 035; Plan 130 G1 | W1 |
| 2 | Persistent `.next/cache` CI cache | Plans 167/168 follow-up | W3 |
| 3 | Manifest `shortcuts` (deep-link blocker resolved by ADR 037) | Plan 157 findings | W1 |
| 4 | Live-region tests for editor save / inspector delete / import / reset | Plan 157 findings | W1 |
| 5 | `slice-types.ts` comment correction | Plan 158 §277 | W1 |
| 6 | Last arbitrary font size (`text-[15px]`) | Plan 163 §4 (#855) | W1 |
| 7 | HomeView progress-width hydration mismatch | Plans 151 §6, 163 §6.4 | W1 |
| 8 | Overlay focus restoration when the trigger unmounted | Plan 163 findings | W1 |
| 9 | `ChatMessage.id` optional-field follow-up (#928 note) | Plan 163 §7 | W1 |
| 10 | Malformed Markdown tables (MD055/MD056 follow-up) | `markdownlint.toml`; Plan 164 | W1 |
| 11 | Stable typecheck for ordinary test files | Plan 165 tooling follow-up | W1 |
| 12 | Viewport-aware graph-density tiering | Plan 152 §6.1 (from Plan 151 §5) | W1 |
| 13 | `e2e/helpers/store.ts` shared seed fixture | ADR 036 §Decision | W2 |
| 14 | Dark-theme passes in the a11y/touch-target specs | ADR 036 §Decision; Plan 130 A19 | W2 |
| 15 | Provider failures mapped onto the `AppError` taxonomy (D3.5) | Plan 131 G8 ledger | W3 |
| 16 | Bounded retry/backoff on provider fetches (D3.6) | Plan 131 G8 ledger | W3 |
| 17 | Debounced AI-settings persistence (D3.7) | Plan 131 G8 ledger | W3 |
| 18 | Plaintext API-key migration gap (D3.2) | Plan 131 G8 ledger | W3 |
| 19 | O(E²) edge dedup in the graph view (D2.7) | Plan 131 D2.7 | W3 |
| 20 | BM25 full-rebuild cliff after one edit (D3.3) | Plan 131 D3.3 | W3 |
| 21 | `plans/perf-baselines.md` naming retired subsystems (D2.18) | Plan 131 D2.18 | W3 |
| 22 | Dead DOMPurify helpers never wired into a sink (D3.4) | Plan 131 ledger correction | W3 |
| 23 | All `console.*` call sites migrated to the logger | ADR 035 §Migration | W3 |
| 24 | ADR status corrections (031/032/033/034/035/036) | ADR sweep | W4 |
| 25 | Record reconciliation across the affected plans + INDEX | scanner sweep | W4 |

## Execution (GOAP Phases 3–4)

Wave 1 ran five owners in parallel over disjoint file sets; waves 2–3 ran after
the files they touch were final.

| Wave | Owner scope | Outcome |
| --- | --- | --- |
| W1 | Error/logging infrastructure (ADR 035 A1–A5 + e2e spec) | `src/lib/logging/logger.ts` (+22 tests), `src/app/{error,global-error,not-found}.tsx`, `global-runtime-handlers.tsx` (+7 tests), mounted in `app-shell.tsx`; `global-not-found.js` deliberately skipped (needs the experimental flag and only helps multi-root-layout apps; documented in ADR 035) |
| W1 | Component fixes | Overlay focus fallback (+2 tests); Home progress gate (+2 tests); `text-body-lg` token (+1 test); `slice-types.ts` comment; `ChatMessage.id` decision recorded |
| W1 | PWA + announcements | 4 manifest shortcuts (spec-checked; `manifest-shortcuts.test.ts` asserts scope + round-trip), 4 new live-region cases |
| W1 | Docs + gates | 7 malformed table sites repaired (strict MD055/MD056 run clean; enabling the rules stays a maintainer decision), `typecheck:test` wired into `scripts/quality_gate.sh` + CI with a re-injection proof |
| W1 | Graph density | Area-preserving, viewport-shaped band with a clamped aspect (`BAND_ASPECT_MULTIPLIER_MIN/MAX`); authored output returned bit-for-bit with no measurement; unit + e2e coverage |
| W2 | E2E fixtures + dark theme | `e2e/helpers/store.ts` validated against the app's own Zod schema; accessibility/touch-target sweeps parametrized over both palettes (dark found clean); 56 tests green |
| W3 | AI hardening | `provider-errors.ts` (taxonomy + retry/backoff), debounced settings save hook, migration now encrypts a plaintext key; 203 tests green across 9 suites |
| W3 | Library hygiene | `Set`-based dedup; tokenization memoized per entry (measured 2,000 entities × 3 claims: single-edit rebuild ≈ 367 ms → ≈ 17 ms); `perf-baselines.md` refreshed; unused DOMPurify helpers + direct dependency removed (override kept for the transitive consumer); `.next/cache` CI cache added |
| W3 | Console migration | 63 call sites across 26 files moved to tagged logger calls; tests updated to assert the structured payload; zero residual `console.*` in `src/` outside the logger's own sink |
| W4 | Verification + records | Full gate, build, four-project-capable Chromium suite, ADR statuses, per-plan notes, INDEX row |

## Discovered and fixed during this plan

The E2E-fixture owner measured a *second* hydration mismatch while building the
theme passes: `next-themes` resolves its state from `localStorage` inside the
client's first render, so the sidebar and drawer theme controls disagreed with
the server HTML (`system` label/icon) for every user who has ever picked a theme
— a React mismatch and subtree re-render on every load. Fixed centrally by
`useHydrationSafeTheme` in `theme-provider.tsx`, consumed by both controls, and
pinned red-first by a new case in `e2e/hydration-mismatch.spec.ts` (failed before
the fix with the icon/label diff; passes after).

## Verification

- `./scripts/quality_gate.sh` (full) — lint, typecheck, 3,061 unit tests,
  shellcheck, `bats tests/`, markdownlint, link validation.
- `pnpm run build` — production build; the precache manifest regenerated (77
  URLs).
- `pnpm exec playwright test --project=chromium` — 214 passed (includes the new
  error-boundary, graph-density, dark-theme and hydration specs).
- Falsifiable proof for the two hydration fixes: the new stored-theme case fails
  against the pre-fix code and passes after; the Home progress case pins the
  server-identical first render and the post-mount width separately.
- `pnpm run typecheck:test` proven able to fail by injecting a type error into a
  `*.test.ts` file, then reverted.
- Migrated `console.*` assertions still assert an emitted warning/error with the
  same essential text plus the structured payload — none deleted, none weakened.

### PR and merge evidence

- Every check on PR #990 passed — `Quality Gate`, `Unit Tests`, `E2E Tests`
  (Chromium, plus the production offline suite because the precache manifest and
  the app shell changed), the security scans — and Codacy reported
  **`Up to standards — 0 issues`**.
- Merged at `4294126` (squash). The `main` push run and the production
  deployment succeeded; the live manifest serving the four shortcuts is the
  deployed build's fingerprint.
- The `code-review-assistant` pass raised one P1 and one P2, both fixed before
  merge (see below), and left no unresolved thread.

## Review follow-up

The review found two integration defects that the unit tests had not covered:

1. **P1 — a transport failure showed the generic provider copy.** The provider
   layer wrapped `fetch` failures in `AI_PROVIDER_ERROR`, whose UI branch says
   "unexpected error"; the network-specific copy was only reachable for
   non-`AppError` throws. `toRequestError` now classifies transport failures as
   `AI_PROVIDER_UNREACHABLE` (with its own user message), and the harness maps
   that code first.
2. **P2 — the debounced settings save could drop an edit.** The saved-signature
   marker was re-assigned when an earlier write resolved late, so a stale value
   could look persisted and a later edit back to it would be skipped; the marker
   is now written once. The loaded state is also recorded as persisted, so
   opening the harness no longer performs a redundant AES-GCM + IndexedDB write
   and a blur before any edit is a no-op.
3. The existing `saves settings after load` test asserted exactly that redundant
   write; it is replaced by one that pins both halves of the contract (opening
   writes nothing, an edit writes). All four new or changed assertions were
   observed to fail with the fixes reverted, then pass (111 green across the
   touched suites, 3,064 in the full suite).
4. An earlier pass cleared the eight Codacy findings in code — braced void arrow
   bodies, a static `switch` for the logger's console sink, CSPRNG-sourced retry
   jitter, and a non-`html` name for the Playwright root locator — with **no new
   suppressions**.

## Recorded follow-ups this plan did not close

- `src/components/studio/views/mindmap-view.tsx` is 525 LOC (was 521 before this
  plan) — over the 500-LOC convention. Extracting its row/toolbar subcomponents
  is the recorded next step; it is a refactor of a11y-pinned code, not a
  micro-edit, so it was not attempted here.
- `markdownlint.toml` MD055/MD056 re-enabling (one line each) needs maintainer
  approval because repository rules forbid editing lint suppressions.

## Excluded — parked candidates (with the recorded reason)

| Candidate | Recorded state (verbatim) | Why not implemented here |
| --- | --- | --- |
| Synthesis Inbox (Plan 11.1) | "❌ Not implemented in the current architecture — candidate, not scheduled"; Plan 166: "Candidates only when prioritized." | No decision exists to schedule it; building it would be new scope, not backlog |
| Visual Query Builder (Plan 11.6) | same | same |
| Optional Mind Map swipe actions | Plan 162 addendum: "remain unbuilt by design: Plan 169 marks swipe 'optional', and §4 is absent from its delivery table" | The spec deliberately excluded them from delivery |
| Graph §4 double-tap / long-press | same quote | same |
| Jev/Von decision-service integration | Plan 155: "left for a separate plan" | No plan, no provider contract |
| Production server for every E2E run | Plan 153: "for a separate decision" | Maintainer workflow decision; an opt-in production suite exists |
| Visual-regression baselines | ADR 036 §Decision | Trustworthy baselines need a CI-matched renderer; recorded in ADR 036's status |
| `plans/OPTIMIZATIONS.md` items (SQLite pooling, OPFS snapshots, CLI headless, plugin config…) | "if worker-based concurrency is introduced", "if cloud sync is ever added", "if profiling justifies it" | Conditioned on retired or absent architecture |
| Drop the ESLint 10 workaround | Plan 140 §2: "Remove the workaround when eslint-plugin-react ships ESLint 10 support" | Re-verified 2026-10-17: upstream still caps at `^9` |
