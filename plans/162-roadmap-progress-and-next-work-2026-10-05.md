# Plan 162 — Roadmap Progress and Next Work

**Date**: 2026-10-05
**Status**: Complete — planning records reconciled; implementation backlog remains open
**Method**: Source inspection against the repository at this date. No test suite, build, browser scenario, deployment, or remote query was executed by this refresh.
**Related**: [155](155-cpu-first-local-ai-and-settings-persistence.md), [157](157-codebase-gap-and-feature-remediation.md), [158](158-september-2026-best-practice-audit.md), [159](159-rejected-library-recovery-visibility-and-fail-closed.md), [161](161-offline-lazy-view-precache-and-framework-refresh-2026-09-30.md), [131](131-goap-swarm-improvement-audit-2026-08-22.md), [130](130-goap-uiux-testpyramid-errorhandling-2026-08-22.md), [ADR 027](ADRs/027-canonical-state-and-p2p-sync-bridge.md), [ADR 037](ADRs/037-url-addressable-view-state.md)

## Evidence vocabulary

Every row below carries one of these exact statuses. They are not interchangeable.

| Status | Meaning |
|---|---|
| `Implemented — source-confirmed` | The behavior exists in the source read at the anchor on 2026-10-05. Runtime behavior was **not** re-exercised by this refresh. |
| `Partial` | Part of the behavior exists; the named remainder does not, or exists without demonstrated integration. |
| `Not implemented — source-confirmed` | A search across `src/` and `e2e/` at the anchor found no implementation of the named thing. |
| `Recorded follow-on — runtime not rechecked` | A prior plan recorded the gap with dated evidence. This refresh did not reproduce it and does not claim a fresh failure. |
| `Candidate — not scheduled` | An idea with no current owner, no anchor, and no scheduled work. |
| `Not checked in this audit` | A fact this refresh deliberately did not query (CI, deployment, issue counts, installed versions, measured coverage). |

Historical results (Plan 161's 2790 unit tests, 642 passed / 4 skipped production
E2E) stay dated and attributed. They are **not** re-asserted as current.

---

## Current implementation progress

| Area | Status | Evidence | Recorded by |
|---|---|---|---|
| CPU-first local AI inference | `Implemented — source-confirmed` | `src/lib/ai/local-adapter.ts:12-32` (transformers.js runtime, lazily imported, streaming via `TextStreamer`, `InterruptableStoppingCriteria` wired to the abort signal), `:247-278` (`send`/`sendStream` race the model load against `AbortSignal`). Settings milestone in [155](155-cpu-first-local-ai-and-settings-persistence.md). | Plan 155, ADR 040 |
| Claim-aware undo, dangling selection, graph canvas restore, mind-map density | `Implemented — source-confirmed` | `plans/157-codebase-gap-and-feature-remediation.md` W1/W3; `src/lib/studio/graph-snapshot.ts` validated read/restore/clear plus viewport state. The completed canvas **bookmark** is not graph revision comparison. | Plan 157 |
| Hydration refusal protection and quarantine | `Implemented — source-confirmed` | `src/lib/studio/hydration-guard.ts`, `hydration-quarantine.ts`, `RecoveryAlerts` in `app-shell.tsx`. Distinct from pre-import recovery (see Missing implementation #1). | Plan 159, ADR 028 |
| Six `React.lazy` view boundaries | `Implemented — source-confirmed` | `src/components/studio/app-shell.tsx:30-35` (Graph, MindMap, AIHarness, Triz, Export, Sync). Offline coverage of these boundaries is a **recorded 2026-09-30 result** from Plan 161, not rerun here. | Plan 161 |
| Test-source type gating | `Implemented — source-confirmed` | `vitest.config.ts:22-29`, `ignoreSourceErrors: false`. Coverage **floors** at `:49-53` are branches 75 / functions 78 / lines 84 / statements 85 — thresholds, not measured current coverage. | Plan 159 F7 |
| Semantic search with lexical fallback | `Implemented — source-confirmed` | `src/lib/search/vector-store.ts:220-247` (batched embedding, partial index cleared on failure), `:350` (`semanticSearch` entry). Not a missing feature. | — |
| `okf` export format | `Implemented — source-confirmed` | `src/components/studio/views/export-types.ts:12` (`ExportFormatId` union); bundle/parse under `src/lib/okf/`. | ADR 031 |
| Encrypted self-contained reader export | `Implemented — source-confirmed` | `src/components/studio/views/use-export-handlers.ts:282-304` — `buildJsonExport → encryptData → buildEncryptedReaderHtml`, downloaded as a Blob, never injected into the DOM. | — |
| Test totals, CI, deployment, open issues, installed versions, measured coverage | `Not checked in this audit` | Deliberately not queried. Plan 161's numbers are dated 2026-09-30 records. | — |

## Missing implementation

These are future-work records. **This plan does not authorize changing any of the
implementations below**; it records them so they stop being lost between plans.

### 1. Recovery reachability and backup outcome — IMPLEMENTED 2026-10-05

**Status: `Implemented — source-confirmed`, verified in a real browser on all
four viewport projects.** The problem statement below is preserved as the
original record; the resolution section follows it.

#### Original problem statement (source-confirmed 2026-10-05)

`restoreFromRecovery` (`src/lib/studio/recovery-helpers.ts`) had no production
caller. The only references outside its own module were the store re-export
(`src/lib/studio/store.ts:40`) and two test suites (`store-coverage.test.ts`,
`store-graph.test.ts`). Imports and tests are not UI callers.

`persistRecoverySnapshot` returned `void` and **skipped** the write above the size
guard, while `importWithRollback` still returned `{ success: true }`
(`src/lib/studio/slices/data-slice.ts`). The UI therefore reported import success
without saying whether a durable pre-import backup existed.

Status at the time of the audit: `Not implemented — source-confirmed`, with the
production reproduction above.

**Reproduced — the silent-skip case.** Imported a ~5 MB single-entity corpus
over the seed corpus. Observed:

| Observation | Value |
|---|---|
| UI after import | `Imported 1 entity and 0 claims` / `1 entities · 0 claims replaced the current library.` |
| Entity names after import | `["Oversized Sentinel"]` — corpus A gone |
| `do-knowledge-studio-recovery` after import | **19,704 bytes, timestamp unchanged from the previous import** |
| Console warning about the skipped write | **none** |
| Any "backup skipped" / "too large" / "no backup" UI | **none** |

The oversized write was skipped exactly as `MAX_RECOVERY_SIZE_BYTES` (4 MiB)
implies, yet the stored snapshot was left holding the *previous* corpus's data
— a stale backup that would restore the wrong state if a restore UI existed —
and the user was told the import succeeded. Nothing in the UI says the
pre-import backup for *this* import was not written.

**Correction to an earlier reading.** A first probe reported
`RECOVERY_BYTES 0`; that was my error — it read the key
`dks-recovery-snapshot`, but the real key is `do-knowledge-studio-recovery`
(`recovery-helpers.ts:16`). With the correct key, an **ordinary** import does
persist a ~19.7 KB snapshot. So "import never backs up" is **false**; the
reproduced defect is narrower and more specific:

1. **No restore affordance.** `RESTORE_UI_COUNT 0` across the whole Export view,
   for both a normal and an oversized import. The snapshot exists and nothing can
   consume it.
2. **A skipped backup is indistinguishable from a successful one.** Same success
   toast either way; no warning, and no signal that the snapshot is stale.

This is a missing reachability path plus a missing outcome report — **not** a
reproduced data-loss incident. Nothing was lost that the user could not already
recover by exporting first, and no restore was attempted because no UI exists.
The later acceptance criteria stand; the restart-and-restore leg remains
unproven and must be demonstrated by the implementation, not inferred here.

#### Resolution (2026-10-05)

All three previously-open acceptance criteria are met, and two additional
data-loss paths found during review are guarded:

| Criterion | How it is met |
|---|---|
| Import B over A, restart, explicitly restore A | `RecoveryBanner` mounts in `RecoveryAlerts` above the view router, so the offer is reachable from **any** view, not just Export. Restoring puts corpus A back and consumes the snapshot. |
| An oversized or storage-refused backup produces truthful UI | `persistRecoverySnapshot` returns `RecoveryPersistResult`; the import shows `toast.warning` ("Imported — but no backup was kept") instead of a false green success. |
| Quarantine and pre-import recovery stay separate | The new banner is a distinct component and storage key from `QuarantineBanner`; the two render side by side when both apply. |

Files: `recovery-helpers.ts` (outcome type, availability signal,
`describeRecoverySnapshot`, non-throwing `readRecoverySnapshot`),
`store-types.ts` (`ImportOutcome`), `slices/data-slice.ts` (threads the outcome),
`views/recovery-banner.tsx` (new), `app-shell.tsx` (mount + subscription),
`use-export-handlers.ts` (truthful toast), `i18n/messages/announce.ts`.

Two further defects were found and fixed while building this, both of which the
new banner would otherwise have made reachable:

1. **A refused backup destroyed the surviving one.** The first implementation
   called `clearRecoverySnapshot()` in the `storage-unavailable` branch. But
   `localStorage.removeItem` still succeeds when `setItem` is refused by a full
   quota, so it deleted the only copy of the corpus being replaced. Only the
   `too-large` branch clears now; a stale-but-real backup survives, and the read
   path re-validates it against the schema and TTL every time.
2. **Restore could delete the backup without saving.** `restoreFromRecovery`
   cleared the snapshot in a catch that also covered `applyRecoverySnapshot`,
   whose `setState` persists and can throw on quota *after* the in-memory swap —
   and it offered restore even in a hydration-refused session where every write
   is dropped. It now refuses while `isSyncBlocked()`, clears only after a
   confirmed-successful apply, and never on a failure path.

**Evidence.** `recovery-backup-outcome.test.ts` (13 unit tests) and
`e2e/recovery-restore.spec.ts` (3 tests × 4 viewport projects). Every new test
was checked against the unfixed code first: 6 fail without the outcome fix, 4
fail without the restore-safety fix, and all 3 E2E cases fail without the
banner. Full gate on the final tree: 181 files / **2804 tests**, 0 type errors,
build clean, **660 E2E passed / 4 skipped / 0 failed**.

**Deliberately not done.** `indexeddb-backup.ts` is untouched and still has no
production caller. Tiered backup remains **not operational**, and no storage
migration is selected here.

### 2. Deletion / export integrity investigation

`deleteEntity` (`src/lib/studio/slices/entities-slice.ts:94-105`) removes the
entity, prunes inbound `links`, drops its `claims`, and clears a dangling
selection. It does **not** touch the optional top-level `graph` node/edge sets,
`mindMap` nodes/edges, top-level `links`, or `tags`. Whether canvas objects are
intentionally independent of entity lifecycle is not documented anywhere.

Status: `Partial` — a source-level gap requiring a real imported-corpus
reproduction. Not proven ghost-node export behavior; no export was run here.

Later acceptance: delete an imported entity that has dependent canvas
references, export, re-import, and undo. Prove referential integrity, or record
in an ADR why independent canvas objects are intentionally retained.

### 3. Sync join/rejoin completion

`handleJoin` (`src/components/studio/views/sync-view.tsx:267-288`) calls
`mergeIntoYjs` and reports success without reading `result.conflicts`, unlike
`handleResync` (`:310-321`) which surfaces them via `setPendingConflicts`.
`handleLeave` calls `destroy()` (`:298-308`), which nulls the provider,
persistence, **and** the Yjs document (`src/lib/sync/doc.ts:75-84`); Join calls
`joinRoom` only, and `initPersistence` (`:37-43`) is never re-invoked on a
Leave→Join cycle.

Status: `Partial`. Tombstone durability consequences across sessions are
`Not reassessed` — this audit did not drive two peers through a leave/join cycle
and does not assert resurrection from source inspection alone.

Later acceptance: two peers with conflicting edits expose conflicts on **initial**
join; Leave→Join reconnects the persistence layer.

### 4. Remaining heavy-leaf deferral

Six lazy views exist, but the heaviest leaves remain statically imported:

- `app-shell.tsx:13` statically imports `EditorView`, which imports
  `CursorTracker` from `../remote-cursors` (`views/editor-view.tsx:14`) →
  `src/components/studio/remote-cursors.tsx:5` → `src/lib/sync/use-cursors.ts:4-11`
  → `src/lib/sync/cursors.ts:1` → `src/lib/sync/doc.ts:1-3` (`yjs`,
  `y-indexeddb`, `y-webrtc`).
- `Export` is lazy, but inside it `use-export-handlers.ts:11-12` statically
  imports `export-documents.ts:2-11` (`jspdf`, `docx`) and `fflate`.

Status: `Partial`. This is a deferral, not a defect: the Export **view** is lazy
and must not be described as eager.

Later acceptance: a production network/bundle trace that distinguishes app boot,
opening Export, and the first PDF/DOCX click.

### 5. Plan 161 recorded follow-ons

Carried forward from `plans/161-...-2026-09-30.md:167-233`. All
`Recorded follow-on — runtime not rechecked`:

| Follow-on | Anchor | Later acceptance |
|---|---|---|
| Dev search-worker `importScripts` chunk failure | `src/lib/search/search-worker-client.ts:69-77` (worker construction with main-thread fallback), `:131-132` (`onerror` settles every pending request) | Dev search worker starts and lexical search returns results without the recorded importScripts error |
| First-mount reduced-motion limitation | `src/lib/studio/use-reduced-motion.ts:21` (`getServerSnapshot = () => false`), `:44-45`; consumers at `src/components/studio/views/home-view.tsx:169-173,309-314` | First paint has no unintended tween **and** no hydration mismatch |
| Workflow linter warnings | `.github/workflows/security-scan.yml:114-116` (yamllint `comments-indentation`), `.github/workflows/ci-and-labels.yml:343` (actionlint `SC2002`) | Workflow linters report no cited warnings |

---

## New feature priorities

Ranked without pre-committing to an implementation design. Deadlines and
mechanics belong to each feature's own later spec.

### F1 — AI request control (first new feature after recovery/integrity work)

`src/components/studio/views/ai-harness-chat.tsx:130-152` disables the textarea
and Send button during loading and offers **no Stop**. The hook
(`use-ai-harness-chat.ts:71,84-89,113-115,184-195`) already owns an
`AbortController` and aborts on unmount, so the capability exists — it is simply
unreachable from the UI. Errors are surfaced as raw `err.message` text.

Links [Plan 131 G8](131-goap-swarm-improvement-audit-2026-08-22.md)'s
provider-hardening proposal.

Status: `Not implemented — source-confirmed`. Later acceptance: Stop cancels a
deliberately stalled or streaming turn, retains already-emitted text, and
re-enables the composer; a bounded request failure ends with safe, localized
error copy.

### F2 — URL deep links and browser history

Reuse [ADR 037](ADRs/037-url-addressable-view-state.md) and Plan 130 A23/A24. No
`location.hash`, `pushState`, `popstate`, or `hashchange` integration exists in
`src/` or `e2e/` (2026-10-05).

Status: `Not implemented — source-confirmed`; ADR 037 remains Proposed.

Later acceptance: cold load of `/#/graph` opens Graph despite a persisted Library;
Back/Forward traverses views; reload retains the hash view; an invalid hash
resolves to Home. Missing-hash behavior follows ADR 037's persisted/default rule
— **no new routing policy**.

### F3 — Pointer/touch graph and mind-map interaction

Links [Plan 04 §4.5](04-feature-roadmap.md), currently checked despite
keyboard-only graph pan/zoom (`src/components/studio/views/graph-view.tsx:130-180`
arrow/+/-/Home handling, `:345-355` node `tabIndex`/`onKeyDown`). No
`onTouch*`/`onPointerDown` handler exists in `graph-view.tsx` or
`mindmap-view.tsx`.

Status: `Not implemented — source-confirmed`. A gesture spec is a prerequisite
to implementation, not part of this documentation task.

Later acceptance: touch drag/pinch/tap manipulates the graph within existing zoom
bounds and preserves keyboard navigation; mind-map gestures do not break its ARIA
tree or native scroll.

### Candidates — not scheduled

Graph **revision comparison**, Synthesis Inbox, and Visual Query Builder.
Linked to [Plan 04 §4.4](04-feature-roadmap.md) and
[Plan 11 §11.1/§11.6](11-expansion-roadmap.md). Their original SQL/Orama designs
are historical. No new storage schema is invented here, and none is scheduled
ahead of the integrity gaps above. Canvas save/restore **is** implemented;
revision comparison is not.

---

## Skills maintenance

| # | Item | Status | Later action | Acceptance |
|---|---|---|---|---|
| S1 | Skills catalog refresh | `Not implemented — source-confirmed` | Run `python3 scripts/generate-skills-docs.py`. **Never hand-edit the generated tables**; `scripts/generate-skills-docs.py:218-224` owns `agents-docs/AVAILABLE_SKILLS.md` and `.agents/skills/README.md`. | Both catalogs contain every valid canonical skill exactly once; two consecutive runs produce identical bytes |
| S2 | Agent-surface doc truth | `Partial` | `agents-docs/MANIFEST.md:50,56` advertises a nonexistent `generate-docs` command; `scripts/agent-surface.py:342-382` accepts only `validate` and `sync`. Correct the docs to the real CLI. | Documented commands match the real CLI; `generate-docs` is not recommended anywhere |
| S3 | Cursor/Windsurf strategy mismatch | `Not reassessed` | `.agents/manifest.json:33-42` declares `"symlink_strategy": "directory"` for `.cursor` and `.windsurf`, while `agent-surface.py:303-336` treats every non-`none` strategy as an all-or-nothing symlink set. Unresolved — **not** supported copy synchronization. | A later tooling task establishes the intended behavior before syncing those directories |

`verify-before-asserting` exists canonically at `.agents/skills/verify-before-asserting`
but appears in **neither** generated catalog (0 matches in each). S1 is its fix.

## Documentation maintenance

| # | Item | Status | Later action | Acceptance |
|---|---|---|---|---|
| D1 | Script catalog drift | `Partial` | `agents-docs/SCRIPTS.md` omits `scripts/generate-precache-manifest.mjs` and `scripts/generate-pwa-icons.py`; its `agent-surface.py` example omits the required `validate` argument (`python3 scripts/agent-surface.py` prints a usage error). | Both build/icon tools documented with real invocation |
| D2 | Nonexistent skip flag | `Not implemented — source-confirmed` | `agents-docs/WORKFLOW.md:71` advertises `SKIP_LINKS=true`. No such variable is read; the link gate is scope-based (`scripts/quality_gate.sh:278-283`). | No nonexistent skip flag is recommended |
| D3 | README claims | `Partial` | `README.md:11,27` advertises an IndexedDB backup tier with no production caller; `README.md:56` says Node >= 20 against `>=22.0.0` in `package.json:8`; local AI and semantic search are omitted. | Backup wording matches production callers; runtime minimum matches `package.json`; optional local-model initial download is distinguished from subsequent offline use. Test counts stay dated records. |

---

## Execution order

1. **Reconcile records** — this document plus the `plans/` edits made alongside
   it. Complete.
2. ~~**Recovery reachability + backup outcome**~~ — **implemented and
   browser-verified 2026-10-05** (see #1 above).
3. **Deletion/export integrity** — now the first open implementation item; it
   touches data safety, so per the delivery lifecycle it starts at production:
   reproduce against an imported corpus, then fix.
4. **Sync join/rejoin completion**, then the three **Plan 161 recorded
   follow-ons** (dev search worker, first-mount reduced motion, workflow
   warnings).
5. **Skills and docs maintenance** — independent of product changes; S1, S2, D1,
   D2, D3 can run in any order and do not block steps 3–4.
6. **F1 AI request control** — first new feature.
7. **F2 deep links**, then **F3 gestures**.
8. **Unscheduled** — revision comparison, Synthesis Inbox, Visual Query Builder.

Step 2 is the one item this plan actually implemented. Every other row stays
open; completing this plan means the records are truthful, not that the backlog
is empty.

---

## Verification evidence

What this refresh actually did, and the observed result:

- **Source reconciliation probes** — read each cited anchor and ran targeted
  searches across `src/`, `e2e/`, `.github/`, `scripts/`, `agents-docs/`,
  `README.md`, `.agents/manifest.json`, and `package.json` on 2026-10-05.
  Five spot-checks re-run after the edits, all agreeing with the recorded status:
  6 `lazy(` boundaries at `app-shell.tsx:30-35`; `ignoreSourceErrors: false` at
  `vitest.config.ts:29`; `restoreFromRecovery` in `src/` has only its definition
  and the `store.ts` re-export outside tests; **0** hash/history hits across
  `src/` and `e2e/`; `verify-before-asserting` present canonically with **0**
  matches in each generated catalog. No feature, skill, or doc item is falsely
  marked done.
- **Document smoke** — `plans/INDEX.md` links Plan 162; all seven required
  sections are present; the recovery (#1), AI request control (F1), skills
  catalog (S1), and manifest-doc (S2) references all resolve to real repository
  files. Implemented progress and open work carry different statuses; the first
  implementation priority is recovery, the first new feature is AI request
  control.
- **Introduced-link check** — a throwaway checker outside the repository resolved
  every relative link in the 14 touched/added Markdown files: **48 real local
  links, 0 unresolved**. (One further match was a false positive: the code
  expression `MIGRATIONS[i](state)` in a pre-existing Plan 160 row, not a link.)
- **Docs gate** — `./scripts/quality_gate.sh --scope docs`, **exit 0**:
  git hooks configured; `agent-surface.py` validation passed; SKILL.md
  references valid across 57 files / 211 links / 0 broken; language detection
  ok; `✓ All Quality Gates PASSED`. No warning or failure was emitted, so no
  follow-on was recorded on account of this gate.

### Gate limitation recorded, not concealed

`scripts/quality_gate.sh --scope docs` invokes `validate-skills.sh` and
`validate-links.sh`, and `validate-links.sh` checks **SKILL.md references only**
(`scripts/quality_gate.sh:278-283`). It therefore does **not** prove that the
Markdown links introduced into `plans/` resolve — the separate introduced-link
check above is what covers them. A green docs gate is necessary, not
sufficient, for this kind of change.

What this refresh did **not** do, and therefore does not claim: any unit test,
build, E2E run, browser scenario, CI/deployment check, open-issue count, or
coverage measurement. Where a number appears, it is Plan 161's dated
2026-09-30 result or a configured threshold from `vitest.config.ts`.