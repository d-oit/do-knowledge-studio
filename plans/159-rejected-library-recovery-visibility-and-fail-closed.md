# 159 — Make Rejected-Library Recovery Visible and Fail-Closed

> Closes the data-loss paths Plan 158 marked done with a hydration item that was
> not actually closed. Behavior decision: ADR 028 §4a.

**Date**: 2026-09-29 (gap analysis and final wiring 2026-09-30)  
**Method**: GOAP (Goal-Oriented Action Planning)  
**Status**: Complete — implemented, gate-verified, the remaining fail-open path
closed, and all 4 follow-ons burned down (see
[Post-implementation gap analysis](#post-implementation-gap-analysis-2026-09-30)
and [Follow-ons](#follow-ons-status-as-of-2026-09-30))

## Problem

A persistence envelope the store refuses to hydrate (future version, corrupt
same-version payload) left the user in a state that looked healthy and was not:

| Path | Old behavior | Consequence |
|---|---|---|
| `QuarantineBanner` mount | Lazy Export view only (`export-view.tsx:78-94`) | A refused library left Home looking like an ordinary demo |
| Banner close icon | Called `clearQuarantine()` | One click deleted the only preserved copy |
| Post-refusal `setState` | Still wrote seed state | The refused envelope was overwritten by the demo corpus |
| `quarantinePayload` | Overwrote a different older payload | A second rejection destroyed the first user's only copy |
| `readQuarantine()` parse failure | Called `clearQuarantine()` | A hand-restored copy was deleted on the next read |
| Cross-tab / Yjs | Ran on a seed workspace | A refused tab rewrote healthy tabs with seed data |
| `quarantineBody` copy | "re-import it here" | The raw envelope is not the export schema; Import rejects it |

## Behavior comparison (unit level)

Each row was observed by running the test before and after the fix.

| Case | Before | After |
|---|---|---|
| `version: 99` envelope + `saveEntity` | live key rewritten with seed | live key byte-identical; quarantine holds exact bytes |
| `QUARANTINE_KEY` write throws `QuotaExceededError` | seed write overwrote original | `preserved: false`, original intact, warning says edits unsaved |
| Older distinct quarantine present | older record replaced | older record **and** current bytes both intact |
| Same-version malformed (skips `migrate`) | seed write overwrote original | blocked via the `merge` gate; `preserved: true` |
| Second rejection, identical bytes | record rewritten | idempotent, `true`, original `rejectedAt` kept |
| Unparseable quarantine bytes | key deleted on read | key left on disk, actionable warning |
| Valid hydrate | persisted normally | unchanged; `getHydrationRefusal() === null` |

### Adverse-case evidence (re-injected defects, LESSON-041)

- Removing the `writeBlocked` condition in `getGuardedStorage` fails 5
  store-persist tests. The observed value is the demo seed entity
  `e1 "TRIZ Contradiction Matrix"` landing in the live key — the exact original
  data-loss bug, reproduced.
- Removing the shell's Yjs refusal gate fails
  `does not start the Yjs bridge while a refusal is live`.

## Design

`src/lib/studio/hydration-guard.ts` (new) owns one page-scoped status and the
guarded `StateStorage`. It imports no store, so `store.ts` and `cross-tab.ts`
can both depend on it without a cycle.

- `recordHydrationRefusal(reason, raw, preserved)` is called **synchronously
  before** either refusal branch returns, because zustand writes the store key
  as soon as `migrate` returns.
- `getGuardedStorage()` is passed to `createJSONStorage` as the getter, so the
  `localStorage` dereference (and its server-side ReferenceError fallback)
  stays exactly where it was.
- Only `setItem(STUDIO_STORAGE_KEY, …)` is intercepted. Quarantine and every
  other key stay writable, otherwise recovery could never run.
- `cross-tab.ts` checks `isSyncBlocked()` at each inbound and outbound entry
  point, because a manual `rehydrate()` can refuse *after* listeners attach.
- A first run with no stored envelope is not a refusal: zustand hands `merge`
  an empty payload, and blocking there would make a fresh install permanently
  read-only with nothing at risk.

## UI

`RecoveryAlerts` in `app-shell.tsx`, above `ViewRouter` inside the scrollable
main column. State initialized in an effect (SSR/client markup must match) and
refreshed on `persist.onFinishHydration()`. Two alerts, shown together when both
apply because they can describe different envelopes:

- `kind: 'preserved'` — a copy is held. Download offered. Dismissal is React
  state only; `clearQuarantine` is not called, and a reload restores it.
- `kind: 'unpreserved'` — no copy. Says edits are not saved. **No hide
  control**, and no download when the bytes are unreadable.

`SyncView` is replaced by a `SyncUnavailable` notice under a live refusal, so
it cannot join a room or resolve conflicts against seed data.

## Verification performed

`pnpm run lint`, `pnpm run typecheck`, `pnpm run test` (2778 passed, 1
skipped), `pnpm run build`, `pnpm run test:e2e` — all clean, zero warnings.
Targeted Vitest across `hydration-quarantine`, `store-persist`,
`quarantine-banner`, `app-shell`, `cross-tab`, `keyboard-nav`.

Real Chromium (managed profile), refused `version: 99` envelope seeded before
app boot:

| Check | Observed |
|---|---|
| Warning on Home without opening Export | visible, `role="alert"`, `aria-labelledby` set |
| Refused bytes in the live key | byte-identical to the preloaded envelope |
| Download contents | 365 bytes, exactly equal to the preloaded envelope |
| Hide for this page session | banner gone, `QUARANTINE_KEY` unchanged |
| Reload | banner returns, `QUARANTINE_KEY` still unchanged |
| Real "Save to library" in the refused tab | in-memory state updated, live key unchanged |
| Banner survives navigation | visible on Library |
| Sync under refusal | unavailable notice, no room controls |
| Denied quarantine write (`QuotaExceededError`) | unsaved-state alert, **no** hide control, download offered, bytes intact |
| Edit with no safe copy | not persisted; alert still shown |
| Mobile 390x844 | banner visible, within viewport, download target 44px, keyboard-focusable |

Cross-tab, one origin, refused tab plus a tab holding a valid v5 corpus:

| Check | Observed |
|---|---|
| Real save in the refused tab | **0** broadcasts observed by the healthy tab |
| Healthy tab's storage after that save | byte-identical, entity still present |
| Inbound to the refused tab | healthy tab's entity never entered its in-memory store |
| Normal hydration control | edit persisted **and** 1 broadcast observed |

Note: both tabs share one origin's `localStorage`, so the refused and healthy
scenarios cannot be isolated within a single browser; the healthy tab's own
write is visible to the refused tab by design. The invariants that matter —
outbound blocking, inbound rejection, and refusal-status handling — were each
measured directly.

## Defect found during verification

The first implementation seeded the shell's refusal state with
`useState(getHydrationRefusal)`. That reads browser-only state during render,
so the server emitted no alert while the first client pass emitted one — React
discarded the entire server-rendered tree on every load of a refused library
(`Hydration failed because the server rendered HTML didn't match the client`,
observed ~19 times in one e2e run, attributed to `RecoveryAlerts`).

Fixed by initializing to `null` and filling in the effect, which is also what
the "initialize only in an effect" rule requires. Confirmed by re-running the
spec against a freshly cleared dev log: 0 hydration mismatches.

Two related notes from the browser pass:

- `SyncView` has no `data-testid`, so the e2e assertion targets the room
  controls it would render (`Join room`, room-id input) rather than a
  fabricated id. The unit test's mock defines that id itself, so its assertion
  still exercises the real `ViewRouter` branch.
- The editor's save control is labelled "Save to library" and the name field is
  `#entity-name`; the first e2e draft used `/^save$/i` and silently clicked
  nothing, which would have made the "edit does not persist" test vacuous.

## Module boundary

`cross-tab.ts` was 492 LOC before this change and the guards pushed it to 531,
over the repository's 500-LOC limit. The pure corpus-merge helpers
(`arraysEqual`, `jsonChanged`, `removedIds`, `mergeCorpus`, `CorpusMerge`) have
no transport, storage, or store dependency, so they moved to
`src/lib/studio/cross-tab-merge.ts`. The module is now 423 LOC and stays about
transport, with its 20 existing tests unchanged.

Consolidating the guards during that move also surfaced a real ordering
constraint: `recordMessageDeletions` must run BEFORE any refusal short-circuit
in the channel handler. The tombstone registry is session bookkeeping about
what a peer deleted, and gating it behind the refusal check broke
`propagates deletions broadcast by another tab` — a deleted item reappeared in
the merge union. The inbound guard therefore lives in `applyRemoteMessage`
(the single corpus choke point), not in the listener.

## Pre-existing failure, not introduced here

`src/lib/__tests__/e2e-harness.test.ts › waits for a served response, not a
bound port` times out: the test's budget is 5s, and the first transform of
`playwright.config.ts` inside vitest takes ~120s. Verified identical on the
clean baseline commit `7b47cd8` with this work stashed, so it is unrelated to
Plan 159. Its assertion is still correct; it is the import that blows the
budget. First item in the follow-ons below.

**Re-checked 2026-09-30.** The full suite now reports 178 files / 2779 passed /
1 skipped with this file green. The 5s budget is only exceeded on a **cold**
transform cache; with `.vite` warm the `playwright.config.ts` import is fast
enough. So this is environment-dependent rather than a standing failure. The
follow-on still stands — a cold CI run can flake it — but it should not be
reported as a currently-failing test.

## Post-implementation gap analysis (2026-09-30)

Re-audited the working tree against ADR 028 §4a after implementation. All seven
rows of the Problem table are closed and lint / typecheck / the full unit suite
are green. Three findings remained; the first was a real fail-open path and is
now fixed.

### F1 (fixed) — a rejected hydrate chain was fail-open

ADR 028 §4a's honesty rule names an **unreadable** envelope as a
`preserved: false` case: the app must say the session's edits are not saved. It
was never reachable from the store.

`onRehydrateStorage` is the only channel for a *rejected* persist chain — the
case where storage reads themselves throw (site data blocked, `SecurityError`,
storage unavailable). It only logged. Everything downstream of it was missing:

| Before | After |
|---|---|
| Chain rejects, nothing recorded | `recordHydrationRefusal(reason, null, false)` |
| Seed workspace's next `setState` writes over the unread envelope | Guarded storage drops the write |
| No alert: `UnpreservedBanner`'s `raw === null` branch unreachable from the real store | Alert renders; no download (nothing readable) and no hide control |
| `app-shell.test.tsx` fabricated `'storage unreadable'` status | Status now produced by the store itself |

This is the same data-loss shape as the original bug, just past a different
gate: a validation *refusal* blocked writes, a chain *rejection* did not. The
store's own `hasStoredEnvelope` comment ("an unreadable store is exactly the
case that must fail closed") described the intent; the wiring was absent.

The new refusal is only recorded when none exists yet — a refusal that already
ran made the stronger `preserved: true` claim, and downgrading it would hide a
copy that does exist.

**Adverse-case evidence (LESSON-041).** With the recording line disabled, the
new `store-persist` case fails with `expected null not to be null`
(`getHydrationRefusal()` stayed null). Restored, it passes.

### F2 (documentation) — Plan 159 was not registered

No `**Status**` header and no `plans/INDEX.md` entry. Both added in this pass.

### F3 (documentation) — the "pre-existing failure" overstated

See [Pre-existing failure](#pre-existing-failure-not-introduced-here): the
`e2e-harness` case passes with a warm transform cache. Corrected from "fails on
`main` too" to "environment-dependent".

### Gate results after the fix

`pnpm run lint`, `pnpm run typecheck`, `pnpm run test` — 178 files, **2779
passed, 1 skipped**, zero warnings.

## Follow-ons (status as of 2026-09-30)

| # | Item | Status |
|---|------|--------|
| F4 | `e2e-harness.test.ts` readiness case timed out on a cold transform cache | **Done** — per-test budget raised to 180s (`CONFIG_IMPORT_TIMEOUT_MS`) on all five config-loading cases. |
| F5 | `security-scan.yml` had no lockfile advisory check | **Done** — new `dependency-audit` job runs `pnpm audit --audit-level=high` (lockfile-only, no install) and gates `security-summary`. It immediately caught 4 high advisories, now remediated. |
| F6 | Editor (549), mindmap (521), graph (520) views over the 500-LOC limit | **Done** — 482 / 486 / 428 LOC via `editor-preview.tsx`, `editor-advanced-fields.tsx`, `mindmap-export.ts`, `graph-elements.tsx`. |
| F7 | `vitest.config.ts` `ignoreSourceErrors: true` left `*.test.ts` source errors ungated | **Done** — all **94** errors (across ~24 files) fixed; `ignoreSourceErrors` flipped to `false`. Rows below. |

### F5 remediation detail

The check that did not exist was already hiding live findings: `pnpm audit`
reported **13 advisories (4 high)** against the lockfile.

| Module | Patched floor | Fix |
|--------|---------------|-----|
| `undici` (jsdom → vitest) | `>=7.29.1` | override `^7.29.0` → `^7.29.1` (resolved 7.30.0) |
| `brace-expansion` 5.x (minimatch → eslint) | `>=5.0.12` | new override `brace-expansion@>=5` → `^5.0.12` |

`pnpm audit` now reports **0 vulnerabilities at every severity**. Both are
same-major transitive bumps; no application code changed.

### F7 detail — test-source type errors cleared, gating restored

`tsconfig.test.json` now reports **0** errors (was 94). Fixes were grouped by
root cause rather than file:

| Root cause | Files | Fix |
|---|---|---|
| `ChatRequest.apiKey` is required; Ollama requests omitted it | `providers.test.ts` | added `apiKey: ''` (adapter ignores it) |
| `{} as Response` mocks do not overlap `Response` | `providers.test.ts`, `speech-coverage.test.ts`, `bridge-coverage.test.ts` | `as unknown as …` |
| `FieldConflict.reason` written as `strategy` | `bridge-branch-coverage.test.ts` | renamed the property |
| Entity/Claim literals used `created`/`updated`, claim `confidence` as a string | `tools.test.ts`, `indexeddb-backup.test.ts` | real field names; `confidence: 0.9` + `verification: 'verified'` |
| `entityHistory: [[]]` is not `HistorySnapshot[]` | `claims-version`, `cross-tab`, `hydration` tests | `[{ entities: [], claims: [] }]` |
| Awareness mock returns literal `null`, so `mockReturnValue({…})` was unassignable | `cursors.test.ts`, `presence.test.ts` | `vi.fn((): unknown => null)` + boundary cast |
| `subscribeToYjs` is positional, tests passed an object | `bridge-coverage.test.ts` | `subscribeToYjs(onEntities, onClaims)` |
| Excess properties on `Entity`/`ChatMessage`/import-result literals | `context`, `graph-index`, `context-coverage`, `use-export-handlers` | removed the property (it was ignored at runtime) |
| `keyof JSX.IntrinsicElements` (no global JSX namespace) | `keyboard-nav*.test.tsx` | `ElementType` |

One production type was the root cause of two test errors and was fixed rather
than worked around: `MigrationOutcome` declared `state: PersistedSlice | unknown`,
which collapses to `unknown` and makes the migrated state unusable. It is now
`state: PersistedSlice` (`hydration.ts`).

**Gating verified (LESSON-041).** With `ignoreSourceErrors: false`, injecting
`const __probe: number = 'not-a-number'` into `claims-version.test.ts` failed the
run with a `TypeCheckError` and exit 1; removing the probe returned it to green.
The flag is not decorative — it now fails on exactly the class of error it was
hiding.

### Review and static-analysis pass (2026-09-30)

- `code-review-assistant` workflow applied to the working tree. One finding
  raised and fixed: `graph-elements.tsx` exported `isEdgeHighlighted`, which no
  module imports (it was private before the split) — the export was removed.
- **Codacy**: the required `Codacy Static Code Analysis` check is PR-scoped and
  this work is an uncommitted tree on `main`, so Cloud findings cannot be
  queried. Local `codacy-analysis` over all 15 changed production files reported
  **0 issues** (ESLint9 + Lizard; ESLint8 skipped its parserServices plugin,
  which needs cloud type info). Repo `eslint` is also clean. This is an
  approximation, not the gate — it must be re-run on the PR.
- **Full e2e suite**, all four projects: chromium **160 passed**, mobile **158
  passed / 2 skipped**, tablet **158 passed / 2 skipped**, desktop-xl **160
  passed** — **0 failures**.
- **Graph accessibility exception, re-derived rather than trusted.** The spec
  claimed axe's `nested-interactive` on the graph page was an unavoidable SVG
  limitation, and the page was excused from *all* serious violations. A probe
  measured the actual target: the `<svg role="img">` itself, containing the
  focusable `role="button"` node groups. The claim holds, so the interaction
  model is unchanged — but the blanket exception was replaced with a scoped one
  (`assertNoAxeViolations(page, { allowRules: ['nested-interactive'] })`), which
  now gates the graph page on every other critical/serious rule. Verified
  load-bearing: dropping `allowRules` fails the test with exactly that rule.
  `assertNoCriticalAxeViolations` (the only other caller) was deleted.
- **New tests for the extracted modules**: `mindmap-export.test.ts` (4 cases:
  filename/blob, fallback background, clone sizing, failure propagation) and
  `graph-elements.test.tsx` (5 cases: line geometry, label only when selected,
  either-endpoint highlighting, perpendicular offset, focus filter).

## PR-stage static-analysis triage (2026-09-30)

PR **#842** (`fix/plan-159-recovery-visibility-and-fail-closed`). Codacy's PR
analysis reported 2 new issues. Both were triaged against the rule source rather
than from the message text.

| # | Pattern id | Location | Verdict | Action |
|---|-----------|----------|---------|--------|
| 1 | `ESLint8_@typescript-eslint_no-confusing-void-expression` | `quarantine-banner.tsx:162` | True positive | Fixed in code (`c3c7e31`) |
| 2 | `ESLint8_xss_no-mixed-html` | `mindmap-export.ts:31` | False positive | Suppressed via `--ignore-issue` |

### Issue 1 — real, fixed

`onHide={() => setHidden(true)}` returns the (void) result of `setHidden` from an
arrow shorthand. Braces around the call preserve behaviour exactly. Verified:
`lint`, `typecheck`, `quarantine-banner.test.tsx` (7), and
`e2e/recovery-warning.spec.ts` (9/9 chromium, including the 44px hide-target
case) all pass. The finding is absent from the re-analysed PR.

### Issue 2 — false positive, suppressed

Suppressed as `FalsePositive` (`resultDataId 131544792851`) with the reasoning
recorded on the PR. Evidence, in order of strength:

1. **Same rule + same line pre-existed.** The identical statement lived at
   `mindmap-view.tsx:154` and is itself a live repo issue
   (`resultDataId 131515264026`). This PR *relocates* the line as part of the F6
   split; the analysis shows `+1 / -1` for the rule.
2. **The rule is already declared an FP by the maintainer** — `.codacy.yml:38`
   (ESLint9) and `.codacy.yml:50` (ESLint8).
3. **The heuristic cannot be satisfied honestly.** Read from the rule source
   (`eslint-plugin-xss@0.1.12` `no-mixed-html`): a variable is only "HTML" if its
   name matches `htmlVariableRules`, default `['html/i']`. Renaming a cloned DOM
   node to contain `html` would placate the rule by lying about the value.
4. **No HTML sink exists.** `element.cloneNode(true)` is a DOM node passed to
   `appendChild`; the only stringification is `XMLSerializer` →
   `image/svg+xml` `Blob` → `Image.src` — it is never assigned to `innerHTML` or
   any HTML string context.

### Config finding — needs maintainer approval, deliberately not changed

`.codacy.yml` is a suppression config, which the repo rules place off-limits
without an explicit request, so this is reported rather than fixed:

- The `disable_rules` entries for `ESLint8_xss_no-mixed-html` and
  `ESLint9_xss_no-mixed-html` are **not in effect** — at least 4 live repo issues
  carry that pattern id (`use-export-handlers.ts:294,297`,
  `shortcuts-dialog.tsx:153`, `mindmap-view.tsx:154`). PR-level `--ignore-issue`
  is the mechanism that actually works; the config file is the one that does not.
- `exclude_paths` lists `.mimicode/**`, but the directory is `.mimocode/**`
  (see the `codacy` skill's gotchas table), so that exclusion is inert.

These are pre-existing and outside PR #842's scope. **Resolved by Plan 160**
(2026-09-30): both inert `disable_rules` lines and the dead `.mimicode/**`
exclude were removed, and every live `xss_no-mixed-html` occurrence was fixed in
code instead — see `plans/160-codacy-open-issues-and-mimocode-cleanup-2026-09-30.md`.

### F4 verification note

The cold-cache slow path (~120s) did **not** reproduce locally even after
removing `node_modules/.vite` (transform measured at 34ms), so the 180s budget
could not be observed failing. It is a defensive widening of an explicitly
failing budget, not a fix reproduced against a red test — recorded honestly
rather than claimed as verified.
