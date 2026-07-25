# Plans Index

**Updated**: 2026-07-25
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Current Status

Plan 073 closes out remaining gaps from Plan 072. All quality gates pass.

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

## Key Metrics (2026-07-18)

| Metric | Before | After |
|--------|--------|-------|
| Unit test files | 22 | 26 |
| Unit tests | 232 | 254 |
| E2E test files | 8 | 8 |
| E2E tests | 58 | 58 |
| Total tests | 290 | 312 |
| CI checks | 22/22 | 22/22 passing |
| LOC violations | 0 | 0 |
| Lint warnings | 0 | 0 |
| Type errors | 0 | 0 |

## ADR Updates (2026-07-17)

| Title | Status | Notes |
|-------|--------|-------|
| P2P Sync Architecture | Accepted | Yjs + WebRTC + QR pairing, dual-layer persistence |
| AI Provider Consolidation | Accepted | OpenRouter + Ollama, streaming, web research |
| Markdown Content and Editor Engine | Accepted | Textarea validated; CodeMirror spike deferred to P3 |
| Editor Draft Persistence | Implemented | Versioned drafts in localStorage, Zod validation |
| Editor Feedback Policy | Implemented | Inline status, no routine toasts |
