# Plans Index

**Updated**: 2026-07-26
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Current Status

Plan 083 improves test coverage from 52.5% to 57% lines, fixes stale plan statuses, marks ADR 011 as superseded, and raises vitest thresholds.

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
| Coverage (lines) | 52.56% | 57.04% |
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
