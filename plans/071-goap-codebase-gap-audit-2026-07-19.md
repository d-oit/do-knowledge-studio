# Plan 071 — Codebase Gap Audit and Remediation GOAP (2026-07-19)

**Date**: 2026-07-19  
**Status**: RESOLVED (by Plans 072, 073, 074)  
**Method**: GOAP (Goal-Oriented Action Planning)  
**Scope**: implementation completeness, product opportunities, agent harness,
skills, instructions, coding workflow, tests, and UI/UX  
**Constraint**: preserve the local-first Next.js baseline from ADR 018

## Outcome

Restore a trustworthy relationship between the product, its documentation, and
its quality gates. The current application has a strong local-first foundation,
but the audit found two data-integrity risks, an incomplete synchronization
boundary, several misleading product claims, gaps in agent-harness enforcement,
weak coverage thresholds, and responsive/accessibility work that is not fully
verified.

This plan replaces the statement in `plans/INDEX.md` that no open P0-P3 work
remains. Current source is authoritative; checked boxes in older Vite/SQLite
plans are historical evidence, not proof of behavior in the current Next.js app.

## Evidence Baseline

### Current architecture

- Next.js 16 / React 19 single-shell application.
- Zustand plus `localStorage` is canonical persistence.
- Markdown is an interchange format, not canonical storage.
- Yjs, IndexedDB, and WebRTC are optional collaboration infrastructure.
- Search is lexical BM25, despite some UI and documentation calling it
  semantic search.
- OpenRouter and Ollama are available in AI Harness; the main Chat view uses a
  local deterministic retrieval response.

### Audit limitations

- Source, tests, plans, scripts, workflow files, and existing generated reports
  were inspected.
- The prior UI audit in `plans/ui-ux-audit-2026-07-11.md` was source-only and is
  partially stale: keyboard semantics, dialog semantics, graph export/history,
  and editor focus treatment have since improved.
- The retry audit ran headless Chromium at 390×844, 768×1024, 1024×768, and
  1440×900. No document-level horizontal overflow was observed at those widths.
- The retry audit ran fresh lint, typecheck, coverage, and Playwright commands.
  Existing generated reports outside those runs remain untrusted.
- No screen-reader, automated axe, 200% text zoom, or 400% reflow pass was
  completed. Those remain G5 verification requirements.

### Fresh retry baseline

| Check | Result | Interpretation |
|---|---|---|
| `pnpm run lint` | Passed | No lint output warnings |
| `pnpm run typecheck` | Passed | No type errors |
| `pnpm run test:coverage` | 254/254 passed | 26.44% lines, 16.66% branches, 19.14% functions, 25.86% statements |
| `pnpm run test:e2e` | 57/58 passed | One strict-locator failure in `search-and-filter.spec.ts` |
| Browser viewport checks | 4 viewports inspected | No page overflow; target-size and compact-text issues reproduced |

The coverage run emitted React, Yjs, and Vitest warnings while still passing.
This directly confirms that the documented warnings-as-errors policy is not
implemented by the current gates.

## Goal Graph

```text
G1 Data integrity ───────┬──> G3 Honest product surface ──> G5 UI/UX verification
                        │
G2 Sync correctness ────┘

G4 Harness integrity ───────> G6 Reliable quality gates ──> G7 Documentation truth
```

G1 and G2 are the release blockers. G4 and G6 can run in parallel with product
work. G3 must precede final UI copy and documentation updates so the interface
does not continue to promise behavior that is absent.

## Prioritized Findings

### P0 — Data integrity and false-success behavior

#### F1. Collaboration is not connected to canonical state

`src/components/studio/views/sync-view.tsx` writes a Zustand snapshot into Yjs
when joining, but no production lifecycle subscribes Yjs changes back into the
store. Store CRUD does not propagate ongoing updates or deletions to Yjs.
Conflict resolution accepts a resolution map but clears conflicts without
applying the selected values. Existing bridge tests cover isolated map helpers,
not two-way canonical-state synchronization.

**Risk**: peers can report successful synchronization while remote edits are not
visible or durable in the canonical library.

**Decision**: ADR 027.

#### F2. Import can replace valid data with a partially accepted payload

`src/components/studio/views/export-helpers.ts` uses shallow record guards and
silently filters invalid records even though complete Zod schemas exist in
`src/lib/studio/schema.ts`. `export-view.tsx` then replaces the canonical
library without a preview, backup, or rollback path.

**Risk**: malformed, future-version, or partially valid archives can cause
silent record loss followed by destructive replacement.

**Decision**: ADR 028.

### P1 — Durability, workflow, and product-trust gaps

#### F3. Persisted hydration trusts unknown runtime data

The Zustand persist migration in `src/lib/studio/store.ts` is a no-op type cast.
Corrupt or old `localStorage` content is not validated at the boundary.

**Remediation**: implement ADR 028 for both import and hydration.

#### F4. Entity deletion leaves incoming links behind

`deleteEntity` removes the entity and claims but does not remove links in other
entities whose `targetId` references the deleted entity.

**Remediation**: make deletion one atomic history transaction and test incoming
and outgoing relationships.

#### F5. API-key ciphertext outlives its session encryption key

`src/lib/studio/ai-settings.ts` persists encrypted settings while keeping the
encryption key in `sessionStorage`. After the session, a newly generated key
cannot decrypt the saved ciphertext.

**Remediation**: choose and document one honest retention model: session-only
credential storage, or passphrase-derived persistent encryption. Do not imply
persistence that cannot survive restart.

#### F6. Search and Chat labels overstate implementation

The retrieval engine is BM25, not embedding/vector semantic search. Desktop
labels it “Semantic”; mobile stores the selected mode but always renders the
filtered entity list. Chat presents a fixed local retrieval response while the
copy invites AI synthesis. The actual provider-backed path is AI Harness.

**Remediation**: first rename modes to Keyword and Ranked/Relevance, wire the
same ranking on mobile, and label Chat as local library Q&A. Treat local
embeddings and provider-backed synthesis as separate opt-in features.

#### F7. Agent-surface validation can pass broken skill artifacts

Two tracked skill symlinks are broken:

- `.agents/skills/memory-context/memory-context`
- `.agents/skills/test-runner/test-runner`

`scripts/agent-surface.py` only checks minimal `SKILL.md` content. It does not
validate symlinks, frontmatter, directory/name agreement, eval schemas, or the
declared surfaces in `.agents/manifest.json`. `validate-skills.sh` therefore
returns success for an invalid surface.

**Decision**: ADR 029.

#### F8. The documented release workflow references absent artifacts

`AGENTS.md` and `.github/workflows/version-propagation.yml` describe a VERSION-
driven release flow, but `VERSION`, `CHANGELOG.md`, and
`scripts/propagate-version.sh` are absent.

**Remediation**: either restore and test the complete automated mechanism or
retire the obsolete claim and workflow. Do not add a manual release path.

#### F9. Security and warning policies are not enforced as documented

The security workflow marks key scanners non-blocking or uses a zero exit code,
then summarizes job success rather than finding counts. Quality scripts inspect
command exit status but do not enforce the root rule that warnings are errors;
`MAX_ALLOWED_WARNINGS` is unused.

**Remediation**: preserve artifact upload under `if: always()`, but allow the
designated scanners to fail. Capture quality-command output and enforce a small,
explicit warning policy.

### P2 — Tests, accessibility, responsive behavior, and completeness

#### F10. Coverage thresholds are too low to protect critical workflows

`vitest.config.ts` requires only 15% lines/statements/functions and 10% branches.
There are focused tests for store, export helpers, retrieval, provider adapters,
encryption, drafts, and isolated sync helpers, but no end-to-end integration
proof for canonical Yjs synchronization, conflict application, deletion
tombstones, safe import rollback, or malformed persisted-state recovery.

Fresh coverage was 26.44% lines, 16.66% branches, 19.14% functions, and 25.86%
statements. Store and export helpers have useful focused coverage, but studio UI
is 6.71% by lines and important views remain at 0% unit coverage.

The Playwright suite contains 58 tests across eight spec files but configures
only one Desktop Chrome project, uses no retries, and does not run in the
inspected CI workflow. Fresh execution produced 57 passes and one failure; with
`trace: 'on-first-retry'` and retries disabled, the failure produced no useful
trace. Nine conditional branches can skip intended assertions, and several
responsive, keyboard, validation, and search tests assert only the page title or
another unrelated element. The accessibility suite checks selected roles and
labels but does not run an automated WCAG engine or verify screen-reader
behavior.

#### F11. Touch targets and compact functional text remain inconsistent

Current source still contains multiple `h-8`, `h-9`, `h-10`, 9-11px functional
labels, and custom controls below the repository’s 44px interactive-target rule.
Examples occur in topbar, mobile drawer, voice controls, chat, AI Harness,
presence, conflict resolution, and shared primitives.

Browser measurement reproduced the problem. At 390px, all 17 measured Graph
controls and all 17 measured Mind Map controls were below 44px on at least one
axis; Chat was 24/24. At 1440px, Graph and Mind Map were each 23/23. The mobile
menu/search controls measured 36×36px. Shared primitives currently encode this
constraint with `h-9 w-9` defaults.

#### F12. Tablet and mobile behavior is weakly specified and weakly tested

The shell, drawer, and responsive breakpoints are improved, but tests do not
prove overflow, content priority, target size, focus order, 200% text zoom, or
orientation changes. Playwright has only a Desktop Chrome project; viewport
tests are manual resize scenarios rather than device projects.

Fresh browser checks found no document-level overflow at 390, 768, 1024, or
1440px. The earlier three-pane-at-1024px finding is stale: the right panel now
waits for the 1100px `wide` breakpoint, leaving a measured 776px main area at
1024px. Remaining concerns are dense topbar controls, aggressive mobile text
truncation, coarse-pointer targets, and the absence of device, touch,
orientation, zoom, and reflow assertions.

#### F13. Product completeness claims remain stale

Examples:

- The offline indicator promises later synchronization, but no durable queue is
  implemented.
- AI Harness “Re-sync” emits success although prompt context is already rebuilt
  directly from current arrays.
- Claims can be created but do not have a complete edit/delete/provenance flow.
- “Graph snapshot” stores one view-state bookmark, not data revisions or diffing.
- README uses obsolete package-manager/provider/architecture information.
- `plans/GOAL.md` and `plans/PHASES.md` retain retired SQLite, OPFS, Orama,
  Tiptap, CLI, and embeddings claims as current completion.

#### F14. Overlay and composite-widget accessibility is incomplete

The mobile drawer, command palette, shortcuts dialog, editor fields, library
rows, and graph nodes have materially improved semantics since the prior audit.
Two current gaps remain:

- the encrypted export overlay lacks complete dialog semantics, initial focus,
  Escape handling, focus containment/restoration, and explicit label/input
  relationships;
- the mind map gives every node `tabIndex={0}` without a containing ARIA tree,
  roving tabindex, or complete Up/Down/Home/End tree navigation.

**Remediation**: move export overlays to one tested dialog primitive and
implement the standard ARIA tree keyboard model for the mind map.

### P3 — Maintainability and polish

- Graph and mind-map disabled history buttons say “coming soon” even when the
  actual condition is only “nothing to undo/redo.”
- Agent documentation references scripts and commands that do not exist.
- Skill setup supports fewer client surfaces than the manifest and docs claim.
- Project-specific skills conflict with current architecture: for example,
  local-chat guidance requires SQLite although the canonical store is Zustand.
- Skill families overlap significantly, increasing routing ambiguity.
- The root instruction file is substantially longer than its own progressive-
  disclosure guidance.

## Coverage Map

| Subsystem | Current evidence | Important missing proof |
|---|---|---|
| Store CRUD/history | Strong unit coverage | dangling-link cleanup; invalid hydration |
| Persistence | Basic localStorage integration | migrations, corruption recovery, rollback |
| Export | Strong helper tests | strict import preview/replace/rollback E2E |
| Search | BM25 unit tests | desktop/mobile parity; large-library budgets |
| AI providers | adapter/context/research tests; providers only 10% lines | credential restart semantics; UI failure paths |
| Chat | store timer/response tests | honest-mode UI and optional provider integration |
| Graph/mind map | graph index and basic E2E | large graph, keyboard model, snapshot semantics |
| Sync | isolated bridge/merge/type tests; 38.5% lines | two-peer lifecycle, deletes, conflict choices |
| PWA/offline | indicator unit test | navigation fallback and reconnect behavior |
| Accessibility | selected semantic E2E tests | axe, screen reader, zoom/reflow, target sizes |
| Responsive UI | five scenarios among 58 Desktop Chrome tests | non-conditional assertions and device coverage |
| Agent harness | shell validators | manifest conformance and executable evals |
| CI/security | unit/build/coverage jobs; no E2E job | fail-closed findings, E2E, warnings-as-errors |

## Verified Improvements Since the Prior UI Audit

These improvements should be preserved and must not be reopened as current
defects without new evidence:

- Library list rows expose keyboard-operable link semantics and names.
- Graph nodes expose role, name, focus, and Enter/Space handling.
- Editor name/description/content fields have persistent labels and visible
  focus treatment; editor modes expose radio state.
- Graph positions are deterministic, edge lookup is indexed, and PNG export plus
  store-backed undo/redo are implemented.
- The right panel waits for the 1100px breakpoint instead of crowding 1024px.
- Light-theme faint text contrast was improved from the value recorded in the
  2026-07-11 audit.
- Home now puts recent work before compact statistics rather than leading with
  four oversized metric cards.

Remaining UI work is therefore concentrated in touch sizing, functional text
size, honest product language, encrypted-export dialogs, mind-map tree behavior,
view-specific loading feedback, and fresh WCAG verification.

## GOAP Actions

### G1 — Protect canonical local data

**Priority**: P0  
**Preconditions**: ADR 028 accepted

| ID | Action | Verification |
|---|---|---|
| G1.1 | Validate persisted state with a versioned Zod schema | malformed and old-version hydration tests |
| G1.2 | Replace shallow import guards with strict payload parsing | invalid field, reference, and version tests |
| G1.3 | Add import preview, explicit replace confirmation, and rollback snapshot | export/import/rollback E2E |
| G1.4 | Remove dangling links during entity deletion | atomic history and persistence tests |
| G1.5 | Decide and implement credential retention semantics | reload and new-session tests |

**Exit criteria**:

- [ ] Invalid imports cannot modify canonical state.
- [ ] A user can recover the exact pre-import state after replacement failure.
- [ ] Invalid persisted data is rejected or recovered without a crash.
- [ ] Entity deletion leaves no dangling claims or links.

### G2 — Complete synchronization semantics

**Priority**: P0  
**Preconditions**: ADR 027 accepted; G1 validation boundary available

| ID | Action | Verification |
|---|---|---|
| G2.1 | Add one lifecycle-owned bidirectional Zustand/Yjs bridge | two independent store/doc integration test |
| G2.2 | Apply manual conflict selections before dismissal | conflict field-value assertions |
| G2.3 | Add deletion tombstones or equivalent versioned delete semantics | edit-versus-delete convergence tests |
| G2.4 | Validate all Yjs data before canonical import | malformed peer update test |
| G2.5 | Correct offline and sync status copy | UI assertions for connected/offline/retry states |

**Exit criteria**:

- [ ] Create, update, and delete converge in both directions.
- [ ] Reload preserves the converged state.
- [ ] Manual resolution changes the chosen canonical fields.
- [ ] No sync UI reports success before canonical commit succeeds.

### G3 — Make the product surface honest

**Priority**: P1  
**Preconditions**: G1/G2 behavior contracts known

| ID | Action | Verification |
|---|---|---|
| G3.1 | Rename lexical search and implement desktop/mobile parity | shared result-order tests |
| G3.2 | Relabel Chat as local Q&A or add explicit provider opt-in | mode-specific UI/integration tests |
| G3.3 | Remove no-op “Re-sync” and false-success controls | no inert primary controls in source/browser audit |
| G3.4 | Rename graph view bookmark or implement true revisions/diff | semantics-specific tests |
| G3.5 | Complete claim update/delete/provenance workflow | CRUD persistence tests |

### G4 — Make the agent harness executable

**Priority**: P1  
**Preconditions**: ADR 029 accepted

| ID | Action | Verification |
|---|---|---|
| G4.1 | Repair broken tracked skill symlinks | `find .agents -xtype l` returns none |
| G4.2 | Make validation manifest-driven | fixture tests for every invalid condition |
| G4.3 | Validate frontmatter, eval JSON, links, and target surfaces | validation fails on seeded defects |
| G4.4 | Align setup behavior with declared clients | clean checkout setup/validate test |
| G4.5 | Remove or repair dead commands in agent docs | repository-relative command-link check |
| G4.6 | Align project-specific skills with Zustand/localStorage | skill evals reject SQLite/backend guidance |

### G5 — Verify and harden UI/UX

**Priority**: P2  
**Preconditions**: G3 labels and controls settled

| ID | Action | Verification |
|---|---|---|
| G5.1 | Enforce 44px coarse-pointer targets in shared controls and outliers | browser target-size audit |
| G5.2 | Establish readable minimum type sizes and contrast-safe text tokens | both-theme contrast report |
| G5.3 | Move encrypted export/reset/delete overlays to one complete dialog contract | keyboard and focus-restoration E2E |
| G5.4 | Validate mobile/tablet/desktop information priority and overflow | 320, 390, 768, 1024, 1280, 1440px evidence |
| G5.5 | Validate keyboard, screen reader, 200% text zoom, and 400% reflow | WCAG 2.2 AA audit |
| G5.6 | Profile editor typing and 1,000-node graph interaction | recorded performance budgets |
| G5.7 | Implement ARIA tree semantics and roving focus for mind map | complete tree keyboard-model E2E |
| G5.8 | Add accessible graph list and larger node hit regions | mobile keyboard/touch E2E |

### G6 — Turn quality policy into enforceable gates

**Priority**: P1  
**Preconditions**: G2/G4 tests define critical paths

| ID | Action | Verification |
|---|---|---|
| G6.1 | Add Playwright to CI and retain traces on failure | required CI job |
| G6.2 | Fix the current 57/58 Playwright baseline and replace conditional/no-op assertions | mutation or deliberate-break proof |
| G6.3 | Add axe scanning plus manual-audit checklist | accessibility artifact |
| G6.4 | Raise coverage incrementally around critical modules | per-module targets before global increase |
| G6.5 | Fail on React/Yjs/tool warnings and make security policy fail closed | seeded warning/finding workflow test |
| G6.6 | Validate staged/PR diffs explicitly | staged, untracked, base/head fixture tests |

Suggested coverage progression after critical tests land:

1. Sync, import, store, persistence, and export modules: 80% lines/branches.
2. AI/search and core UI state modules: 70% lines/60% branches.
3. Global floor: raise from 15/10 to 50% lines/functions/statements and 40%
   branches, then ratchet without lowering.

### G7 — Reconcile instructions, plans, and product docs

**Priority**: P2  
**Preconditions**: G1-G6 behavior and gates complete

| ID | Action | Verification |
|---|---|---|
| G7.1 | Replace historical “all complete” claims with a current feature matrix | matrix links to source/tests |
| G7.2 | Mark retired Vite/SQLite plans as historical | no current architecture ambiguity |
| G7.3 | Repair pnpm, provider, view-count, persistence, and release docs | documentation command check |
| G7.4 | Reduce root instructions via progressive disclosure | canonical rules remain discoverable |
| G7.5 | Re-run code, harness, test, and browser audits | closeout report with fresh evidence |

## New Feature Opportunities

These are not defect remediation and should start only after G1-G3:

1. Safe import merge-by-ID with duplicate/conflict preview.
2. Local hybrid BM25/vector retrieval with an optional downloadable model.
3. Explicit provider-backed Chat mode with local retrieval citations.
4. Named graph-data revisions with restore and diff.
5. Mind-map reparenting, ordering, drag/drop, and cycle prevention.
6. Markdown and encrypted-archive restore paths.
7. Durable offline operation queue after sync semantics are complete.

## Execution Waves

### Wave 0 — Decisions and truth (parallel)

- Accept or revise ADRs 027-029.
- Correct only the highest-risk false-success copy while fixes are in flight.
- Establish fresh test, coverage, browser, and harness baselines.

### Wave 1 — Data safety and synchronization

- Execute G1 and G2 sequentially at the canonical-state boundary.
- Do not add sync queueing or new collaboration UX before convergence tests pass.

### Wave 2 — Harness and CI integrity (parallel with Wave 1)

- Execute G4, then G6.
- A green validator must mean the declared artifact is actually usable.

### Wave 3 — Product and UI trust

- Execute G3, then G5.
- Browser-check every changed workflow at mobile, tablet, and desktop sizes.

### Wave 4 — Documentation closeout

- Execute G7 only from verified current behavior.
- Update `plans/INDEX.md`, `plans/PHASES.md`, README, and root instructions without
  copying unchecked historical claims.

## Global Quality Gates

For each implementation wave:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run build
pnpm run test:e2e
./scripts/quality_gate.sh
```

Additionally:

- Run agent-surface validation with negative fixtures after G4.
- Run a structured code review after CI passes and before merge.
- Treat warnings and skipped/conditional critical assertions as failures.
- Record any unavoidable blocker as a new scoped plan; do not mark this plan
  complete based only on source implementation.

## Completion Criteria

- [x] All P0 findings are resolved with regression tests. *(Plan 072 W1: Zod hydration, import validation, deletion link cleanup)*
- [x] All P1 findings are resolved or superseded by an accepted ADR. *(Plans 072/073: ADRs 027/028/029 accepted, security fail-closed, product labels corrected)*
- [x] Critical local data paths reject invalid external state. *(Plan 072: Zod hydration boundary)*
- [x] Sync converges for create, update, delete, reload, and manual conflicts. *(Plan 074: bidirectional Yjs/Zustand bridge with origin tagging, tombstones, conflict resolution)*
- [x] Skill/harness validation fails on broken symlinks and invalid manifests. *(Plan 072 W0: broken symlinks fixed)*
- [x] Security and warning gates cannot summarize known findings as success. *(Plan 072 W2: security fail-closed, warnings-as-errors)*
- [x] Playwright runs in CI with meaningful mobile/tablet/desktop assertions. *(Plan 073 W3: Playwright mobile/tablet device projects added)*
- [ ] Fresh accessibility evidence covers keyboard, semantics, contrast, zoom, reflow, and target size. *(Partial: touch targets + ARIA done in 073/074; full axe audit deferred to Plan 075)*
- [x] Product copy and plans describe only behavior verified in current source. *(Plans 072/073: semantic→ranked labels, coming-soon tooltips)*
- [x] `plans/INDEX.md` is updated with measured, fresh closeout metrics. *(Plan 074: INDEX.md updated with 361 tests, 28/19/20/28% coverage)*
