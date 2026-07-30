# Plans Index

**Updated**: 2026-07-29
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Current Status

### Session Summary (2026-07-29 — 13 PRs merged)

| Area | PRs | Key Changes |
|------|-----|-------------|
| A11y E2E suite | #539–#543 | Strict axe assertions, color-contrast fixes, graph a11y fix |
| UI smoke tests | #540 | 9 shadcn primitive tests (782 additions) |
| Plan reconciliation | #544, #547–#549 | 7 plans reconciled, Status: DONE lines added |
| Release policy | #545 | Never create release without explicit human instruction |
| Version reconciliation | #546 | VERSION file, package.json, MIGRATION.md → 0.1.0 |
| Historical annotations | #548 | 9 superseded plans annotated with Historical Notes |
| Error boundary tests | #551 | 14 new tests for ErrorBoundary + ViewErrorBoundary |
| .gitignore cleanup | #550 | Added *.tsbuildinfo, removed duplicates |
| AI Harness E2E + component tests | #555 | 13 E2E tests + 81 unit tests for 6 untested components |

**Final metrics**: 1,567 unit tests, 111 E2E tests, 0 open PRs, quality gate green, Codacy clean.

### Historical Plan Reconciliation (2026-07-29)

Added `Historical Note` blockquotes to 9 superseded plans (040–078) documenting their
relationship to the retired Vite/SQLite/Orama/CLI architecture (superseded by ADR 018 —
Next.js + Zustand + localStorage). Plans retain historical context; remaining unchecked
items were completed in later plans (090–096).

| Plan | Note |
|------|------|
| 040, 041-ui, 042, 05, 070 | Retired architecture note |
| 041-ai-harness | Retired AI architecture (superseded by ADR 025) |
| 051 | Superseded Vercel config |
| 068 | Follow-ups completed in 090–096 |
| 078 | Implementation-plan checkboxes, all success criteria done |

### Plan 096 — WCAG Touch Target and E2E Learnings (2026-07-29)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Document touch target and E2E learnings | Done | plans/096-wcag-touch-target-and-e2e-learnings-2026-07-29.md created |

### Plan 095 — Fix Pre-Existing Color Contrast Violations (2026-07-29)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Fix CSS token contrast ratios in globals.css | Done | Light: --ink-faint/--ink-mute/--muted-foreground #6a6660/#6b6760 -> #5c5852 (6.1:1); Dark: #827d72/#9b958a -> #a09a8e (5.8:1) |
| W1 | Remove kbd opacity modifiers | Done | mobile-drawer.tsx, sidebar.tsx: removed /70 opacity (was 3.2:1) |
| W2 | Fix react-day-picker v10 breaking change | Done | calendar.tsx: renamed `table` -> `month_grid` in classNames (v10 UI enum key) |
| W2 | Bump @radix-ui/react-alert-dialog | Done | ^1.1.14 -> ^1.1.23 (replaces closed dependabot PR #532) |
| W3 | Extend strict axe assertions to all 10 views | Done | accessibility.spec.ts: all views now use assertNoAxeViolations (critical + serious) |
| W3 | Fix pre-existing lint warning | Done | collapsible.test.tsx: removed unused `container` destructuring |
| W4 | Quality gate + PR | Done | PR #541 merged — all CI checks pass, 1379 tests, Codacy clean |

### Plan 094 — Smoke Tests for Remaining 9 shadcn UI Primitives (2026-07-29)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Extract shared a11y helpers | Done | e2e/helpers/a11y.ts — assertNoCriticalAxeViolations, assertNoAxeViolations with WCAG 2.2 AA tags |
| W1 | Add 9 shadcn UI primitive test files | Done | 782 additions across 14 files: ToggleGroup, Slider, Popover, HoverCard, Progress, Breadcrumb, Avatar, AspectRatio, Collapsible tests |
| W2 | Quality gate + PR | Done | PR #540 merged — all CI checks pass, Codacy clean |

### Plan 093 — Full Accessibility Audit E2E Suite and UI Primitive Tests (2026-07-29)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | ARIA radiogroup keyboard focus fix | Done | editor-view.tsx: arrow keys now move focus to selected radio (ARIA pattern) |
| W1 | WCAG 2.5.5 touch targets (min-h/min-w 44px) | Done | 12+ component files: sidebar, topbar, home, library, editor, chat, type-selector, right-panel |
| W2 | E2E touch-target test | Done | Desktop viewport, skip-nav + SVG <g> graph node exclusions |
| W2 | Codacy compliance | Done | 5 issues resolved (3 Object Injection Sink + 2 ErrorProne false positives) |
| W3 | Quality gate + PR | Done | PR #539 merged — all CI checks pass, 1322 tests, Codacy clean |

### Plan 092 — GOAP: Complete Plan 091 Deferred Smoke Tests & Reconcile Stale Plan Checkboxes (2026-07-29)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Add 4 missing shadcn UI smoke tests (dialog, input, badge, card) | Done | 4 new test files, 39 new tests covering rendering, variants, data-slots, disabled state, asChild, Escape-to-close |
| W2 | Reconcile stale plan checkboxes (091, 068, 089) | Done | Plan 091 deferred item checked; Plan 068 #480/#481 marked done; Plan 089 PWA/AI items updated |
| W3 | Quality gate + PR | Done | Lint, typecheck, test, build pass; PR created |

### Plan 091 — GOAP: Address Remaining plans/ Gaps, Coverage, and ADR Cleanup (2026-07-28)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Update stale plan checkboxes (065, 068, 071, 089) | Done | Plans 065, 068, 071, 089 exit criteria checked off |
| W1 | Check ADR 003 E2E test criterion | Done | ADR 003 acceptance criterion verified via WebCrypto encryption |
| W2 | Add hook tests (use-toast, use-mobile) | Done | 20 new tests covering toast state, dismiss, reducer, mobile breakpoint |
| W2 | Add service-worker-registration test | Done | 5 tests covering mount registration, error handling |
| W3 | Quality gate + PR | Done | Lint, typecheck, test (1212), build all pass; PR #535 created with all 20 CI checks passing |

### Plan 090 — GOAP: PWA Service Worker, AI Provider Tests, A11y Automation (2026-07-28)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Service worker with cache-first strategy | Done | `public/sw.js` enhanced with cache-first for static, network-first for API |
| W1 | Offline indicator in app shell | Done | `app-shell.tsx` — added OfflineIndicator import (component already existed) |
| W1 | AI provider unit tests | Done | `providers.test.ts` — 53 tests covering adapter selection, URL validation, error handling |
| W1 | Keyboard navigation tests | Done | `keyboard-nav.test.tsx` — 48 tests covering Overlay, CommandPalette, Sidebar, Topbar, etc. |
| W2 | Quality gate + PR | Done | Lint, typecheck, test (1143), build all pass; PR #534 created with all 20 CI checks passing |

Plan 088 addresses remaining plans/ documentation and accessibility gaps: ADR status updates, skip navigation, zoom/reflow CSS, and plan checkbox updates.

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Update 8 ADR statuses to Implemented/Superseded | Done | ADRs 003, 020, 025, 026, 027, 028, 029 → Implemented; ADR 06 → Superseded |
| W2 | Add skip navigation link + zoom/reflow CSS | Done | app-shell.tsx skip-nav, globals.css prefers-reduced-motion + 225px viewport |
| W3 | Fix GOAL.md stale coverage, check plan checkboxes | Done | GOAL.md updated to 57%, plan success criteria checked |
| W4 | Quality gate | Done | Lint, typecheck, test (1048), build all pass |

Plan 087 addresses remaining ADR implementation gaps: P2P sync conflict resolution, bidirectional sync bridge, recovery snapshots, import referential integrity, agent harness manifest integration, and editor enhancements.

### Plan 087 — GOAP: Address Remaining ADR Implementation Gaps (2026-07-27)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Implement conflict resolution application | Done | `sync-view.tsx` — handleConflictResolve applies resolutions; `bridge.ts` — applyConflictResolution function |
| W1 | Implement bidirectional sync bridge lifecycle | Done | `bridge.ts` — startBidirectionalSync, `app-shell.tsx` — wired into app lifecycle |
| W2 | Persist recovery snapshots across sessions | Done | `store.ts` — importWithRollback persists to localStorage with 24h TTL |
| W2 | Add referential integrity check on import | Done | `export-helpers.ts` — parseImportFile validates claim entityId references |
| W3 | Setup reads manifest for all tools | Done | `setup-skills.sh` — reads manifest.json, creates symlinks for all declared tools |
| W3 | Add sync command to agent-surface.py | Done | `agent-surface.py` — sync_managed_surfaces function |
| W4 | Add fenced code block for multiline selections | Done | `formatting.ts` — applyInlineCode detects multiline and wraps in fenced block |
| W4 | Add split-mode width collapse | Done | `editor-view.tsx` — useEffect collapses split on narrow viewports |
| W5 | Quality gate | Done | Lint, typecheck, test (1048), build all pass |

### Plan 084 — GOAP: Address Remaining Implementation Gaps (2026-07-26)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Update ADR 012 status to "Implemented" | Done | plans/ADRs/012-pdf-export-strategy.md updated to reflect jsPDF implementation |
| W2 | Enhance ADR 029 validator | Done | scripts/agent-surface.py now validates broken symlinks, frontmatter, name mismatches, eval JSON, duplicate names |
| W3 | Accessibility audit documentation | Done | plans/084-accessibility-audit-report.md created with findings and recommendations |

### Plan 083 — GOAP: Coverage to 55%, Plan Status Fixes, ADR 011 Cleanup (2026-07-26)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Fix stale plan statuses (082, 078, 079) | Done | Plans 082, 078, 079 status fields corrected |
| W1 | Mark ADR 011 as Superseded | Done | plans/ADRs/011-cli-command-extraction.md updated |
| W2 | Add tests for 9 untested components/hooks | Done | 9 new test files, 109 new tests |
| W3 | Raise vitest coverage thresholds | Done | lines 45→53, branches 37→45, functions 37→42, statements 45→53 |
| W4 | Quality gate verification | Done | Lint, typecheck, test, build all pass |

### Plan 082 — GOAP: Address Missing Implementations from plans/ Analysis (2026-07-26)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Fix ADR 001 status to "Superseded" | Done | plans/ADRs/001-sqlite-wasm.md updated |
| W1 | Complete bundle size analysis | Done | plans/startup-audit.md updated with actual metrics |
| W2 | Implement versioned hydration migrations | Done | src/lib/studio/migrations.ts (new), store.ts updated to use migrations |
| W3 | Add tests for TRIZ data, speech recognition, research, AI settings, sync bridge | Done | 6 new test files, 181 new tests |
| W4 | Fix lint warnings | Done | 6 lint warnings resolved |
| W5 | Quality gate verification | Done | Lint, typecheck, test, build all pass |

### Plan 081 — Overlay Migration, Semantic A11y, Dead Code Removal (2026-07-26)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W1 | Overlay variant support (center, sheet-bottom, sheet-left, fullscreen) | Done | #516 | Added variant prop, backdrop/content split, 4 layout variants |
| W2 | Migrate command-palette, mobile-drawer, shortcuts-dialog to Overlay | Done | #516 | Removed manual Escape/focus trap/scroll lock from 3 surfaces |
| W2 | Search listbox ARIA semantics | Done | #516 | role="listbox" + role="option" + aria-selected in right-panel + mobile-drawer |
| W2 | Remove dead useFocusTrap hook | Done | #516 | Deleted use-keyboard-trap.ts + test (never imported by components) |
| W3 | Tests + docs | Done | #516 | 7 new Overlay variant tests, ADR 014 → IMPLEMENTED, GOAL.md updated |
| W4 | PR + CI Verification | Done | #516 | All 20 CI checks pass, 0 Codacy issues |

### Plan 080 — Gap Remediation: GOAL.md, ai-harness split, shadcn exception (2026-07-26)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W1 | GOAL.md stale remaining work + sync description | Done | #515 | Removed completed Plan 074 items, updated sync to bidirectional (ADR 027) |
| W1 | AGENTS.md shadcn exception | Done | #515 | Added exception for vendor primitives (sidebar.tsx 733 LOC) |
| W2 | ai-harness-view.tsx split (511→255 LOC) | Done | #515 | Extracted settings panel (272 LOC) and chat panel (112 LOC) |
| W3 | PR + CI Verification | Done | #515 | All 22 CI checks pass, 0 Codacy issues |

### Plan 079 — View Test Coverage + PR (2026-07-25)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W1 | View Test Files | Done | #514 | Added 5 test files: ai-harness (12), chat (14), library (11), sync (13), triz (17) |
| W2 | Coverage Thresholds | Done | #514 | Updated thresholds: lines 45%, branches 37%, functions 37%, statements 45% |
| W3 | PR + CI Verification | Done | #514 | All 22 CI checks pass, 0 Codacy issues |

### Plan 078 — GOAP Gap Remediation: LOC, Architecture, Coverage, E2E CI (2026-07-25)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W0 | Baseline Scan | Done | — | Confirmed 502 tests, export-view 594 LOC, stale ARCHITECTURE.md |
| W1 | P0+P1 Critical Fixes | Done | #512 | Split export-view.tsx (594→128 LOC), rewrote ARCHITECTURE.md, added E2E CI job |
| W2 | Test Suite Expansion | Done | #512 | schema.test.ts (71), sync tests (53), view tests (39) — 163 new tests |
| W3 | Coverage Thresholds | Done | #512 | Updated thresholds: lines 40%, branches 30%, functions 31%, statements 40% |
| W4 | PR + CI Verification | Done | #512 | All 22 CI checks pass, E2E test fix, admin merge (Codacy pre-existing) |

### Plan 077 — Review Findings Remediation (2026-07-25)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W1 | Dead Code + ARIA (P1) | Done | #510 | Removed redundant Escape listener, added aria-invalid/aria-describedby |
| W2 | Keyboard Navigation (P2) | Done | #510 | TRIZ matrix keyboard, radio group arrows, type selector Escape/arrows |
| W3 | Focus & ARIA Polish (P2) | Done | #510 | Claims slider focus-visible, 3 decorative icons aria-hidden |
| W4 | Touch Targets (P3) | Done | #510 | 20 buttons fixed to min-h-[44px] |

### Plan 076 — Accessibility Audit, Overlay Migration, and Quick-Win Remediations (2026-07-25)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W0 | Baseline & Branch Setup | Done | — | Clean baseline: 502 tests, 31.63% coverage, 22/22 CI |
| W1 | A11y Audit (Swarm) | Done | — | 3 parallel agents: 68 findings (21 critical, 15 serious, 24 moderate, 8 minor) |
| W2 | ARIA & Semantic Fixes | Done | #508 | 18 ARIA fixes: labels, roles, live regions, table captions |
| W3 | Keyboard, Focus & Touch Target Fixes | Done | #508 | 8 focus fixes + 12 touch target fixes + Overlay migration |
| W4 | Motion & Polish | Done | #508 | prefers-reduced-motion gating for ai-harness-view + TypingIndicator |

### Plan 075 — Coverage, Overlay, Claims History, and Docs Reconciliation (2026-07-25)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W0 | Baseline & Documentation Reconciliation | Done | — | Plan 072 OPEN→DONE, Plan 074 PLANNING→DONE, Plan 071 exit criteria checked |
| W1 | Coverage Improvement (G2) | Done | #505 | 8 new test files, 492 tests, coverage 30.87%→31.63% lines |
| W2 | Overlay Primitive (G4) | Done | #505 | Shared `<Overlay>` component with focus trap, Escape, backdrop, ARIA |
| W3 | Claims Version History (G5) | Done | #505 | `version` field (auto-increment), `editHistory` array |
| W4 | Final Verification & Documentation (G6) | Done | #505 | INDEX.md updated, quality gate passed |

### Plan 074 — Sync Bridge, A11y, Data Layer, and Documentation (2026-07-25)

| Wave | Goal | Status | PR | Changes |
|------|------|--------|-----|---------|
| W0 | Baseline & ADR Classification | Done | — | Baseline: 361 tests, 28/19/20/28% coverage |
| W1 | Data Layer (G1) + ADR Cleanup (G7) | Done | #502 | ClaimSchema `createdAt`/`updatedAt`, 13 ADR statuses updated |
| W2 | Touch Targets (G3) + Export ARIA (G4) | Done | #502 | ≥44px targets in graph/mindmap/chat/shared, export dialog ARIA |
| W3 | Sync Bridge (G2) | Done | #503 | Bidirectional Yjs/Zustand bridge, origin tagging, tombstones, inbound validation, conflict resolution |
| W4 | Documentation (G6) | Done | This update | INDEX.md, Plan 071 status |

### Deferred to Plan 076

- Full accessibility audit (axe scanning, screen reader verification, 200% zoom, 400% reflow)
- Coverage target to 50% (incremental, not one-shot)

### Plan 073 — Closeout of Plan 072 Remaining Gaps (2026-07-24)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W0 | Baseline & Verification | Done | 10 gaps verified from source |
| W1 | Import Safety (P0) | Done | Import preview step, `importWithRollback` with atomic replacement and undo |
| W2 | Product Honesty + CI (P1) | Done | Chat label fixed, mobile BM25 wired, claim CRUD (edit/delete), version-propagation workflow retired, GitLeaks fail-closed, SSRF fix |
| W3 | UI/UX Polish (P2) | Done | Mind map ARIA tree + roving tabindex, Playwright mobile/tablet projects, coverage thresholds raised (25/25/18/15), 44px touch targets |
| W4 | Documentation (P2) | Done | This update |

### Deferred to Plan 074

- G2: Bidirectional Yjs/Zustand sync bridge (requires G1 validation boundary)
- Full accessibility audit (axe scanning, screen reader verification, 200% zoom)

### Plan 072 — GOAP Remediation (2026-07-24)

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W0 | Decisions & Baseline | Done | ADRs 027/028/029 accepted, broken symlinks fixed |
| W1 | Data Integrity (P0) | Done | Zod hydration, import validation, deletion link cleanup, session-only credentials |
| W2 | Harness & CI (P1) | Done | Version-propagation disabled, security fail-closed, warnings-as-errors |
| W3 | Product Honesty (P1) | Done | Semantic→Ranked labels, Re-sync removed, coming soon tooltips fixed |
| W5 | Documentation (P2) | Done | This update |

## Historical Completed Work

## Completed - 2026-07-18 Session (Phase 10: Docs & Code Hygiene)

| Plan | Description | PRs |
|------|-------------|-----|
| 070 | Docs alignment: PHASES.md, GOAP.md, INDEX.md; LOC remediation: triz-data split, ai-harness extraction | 481 |

## Completed - 2026-07-17 Session (Phase 8 + Phase 9 full)

| Plan | Description | PRs |
|------|-------------|-----|
| 065 | AI provider consolidation: OpenRouter + Ollama | 461, 462, 464 |
| 066 | Phase 8: P2P sync, voice, presence, cursors | 465-475 |
| 067 | Phase 9: Bundle optimization — lazy-load views | 476 |
| 069 | Phase 9: PWA offline, accessibility, UX polish | 478, 480 |

## Completed - 2026-07-16 Session (Plan 065, PR #461)

| Plan | Description | PRs |
|------|-------------|-----|
| 065 | AI provider consolidation: OpenRouter + Ollama CPU-only, typed adapters, BM25 context, Zod validation | 461 |

## Completed - Earlier Sessions

| Plan | Description | PRs |
|------|-------------|-----|
| 063 | Advanced TRIZ: real 39x39 contradiction matrix, 40 principles with examples, interactive matrix view | 449 |
| 062 | Component consolidation: Button, FieldLabel, TextInput, Divider, ToolbarBtn, ToggleButtonGroup primitives | 448 |
| 061 | CodeMirror 6 evaluation spike: recommendation keep textarea, revisit when syntax-aware/multi-cursor needed | 447 |
| 060 | E2E test harness: Playwright — 58 tests for keyboard, a11y, CRUD, search, command palette, responsive | 446 |
| 059 | P3 perf/disclosure/locale: Intl.DateTimeFormat, settings collapsed, useCallback clearFilters | 445 |
| 058 | GOAP swarm: saffron contrast, dialog semantics, home redesign, tablet breakpoint, tests | 437 |
| 053 | Markdown editor: real formatting, safe drafts, quiet feedback, responsive modes, a11y | 430, 431 |
| 048 | Next.js migration cleanup: remove dead deps, fix configs, add tests | 399 |
| 049 | AI provider integration, encrypted export, zod schemas, BM25 retrieval | 399 |
| 040 | Complete export pipeline (PDF, JSON schema v1.0, MD round-trip) | 289 |

## Key Metrics (2026-07-26)

| Metric | Before (082) | After (083) |
|--------|-------------|-------------|
| Unit test files | 60 | 69 |
| Unit tests | 923 | 1037 |
| E2E test files | 8 | 8 |
| E2E tests | 58 | 58 |
| Total tests | 981 | 1095 |
| CI checks | 22/22 | 22/22 passing |
| LOC violations | 0 | 0 |
| Lint warnings | 0 | 0 |
| Type errors | 0 | 0 |
| Coverage (lines) | 52.56% | 57.04% (targets met) |
| Coverage (branches) | 45.13% | 50.02% |
| Coverage (functions) | 41.46% | 45.73% |
| Coverage (statements) | 52.66% | 57.50% |

## ADR Reconciliation (2026-07-25)

| ADR | New Status | Reason |
|-----|-----------|--------|
| 002 Security Export | Implemented | XSS prevention via WebCrypto AES-GCM |
| 004 DB Migration | Superseded by ADR 028 | localStorage replaces SQLite |
| 005 Error Handling | Superseded by ADR 028 | Specific patterns replace generic |
| 010 Export Schema v1 | Implemented | Zod validators in schema.ts |
| 013 Design Tokens | Implemented | @theme block in globals.css |
| 015 Responsive Theming | Implemented | Mobile-first Tailwind breakpoints |
| 016 Feature Gap Closure | Superseded | By Plans 072/073 |
| 018 Next.js Architecture | Implemented | Production baseline |
| 019 AI Provider | Superseded by ADR 025 | OpenRouter + Ollama consolidation |
| 021 Encrypted Export | Implemented | WebCrypto in encrypt.ts |
| 022 Retrieval Engine | Implemented | BM25 in retrieval.ts |
| 023 Draft Persistence | Implemented | Versioned localStorage drafts |
| 024 Feedback Policy | Implemented | Inline status, no routine toasts |
| 011 CLI Extraction | Superseded by ADR 018 | CLI removed during Next.js migration |
