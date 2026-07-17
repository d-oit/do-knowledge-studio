# Plans Index

**Updated**: 2026-07-17
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Remaining Work

All P0-P3 items from the plan backlog are now COMPLETE.
Phase 8 collaboration features are COMPLETE.
Phase 9 (Performance, PWA & Polish) is COMPLETE.

No open tasks remaining.

## Completed - 2026-07-17 Session (Phase 8 + Phase 9 full)

| Plan | Description | PRs |
|------|-------------|-----|
| 065 | AI provider consolidation: OpenRouter + Ollama | 461, 462, 464 |
| 066 | Phase 8: P2P sync, voice, presence, cursors | 465-475 |
| 067 | Phase 9: Bundle optimization — lazy-load views | 476 |
| 069 | Phase 9: PWA offline, accessibility, UX polish | 478 |

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

## Key Metrics (2026-07-17)

| Metric | Before | After |
|--------|--------|-------|
| Unit test files | 22 | 26 |
| Unit tests | 232 | 252 |
| E2E test files | 8 | 8 |
| E2E tests | 58 | 58 |
| Total tests | 290 | 310 |
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
