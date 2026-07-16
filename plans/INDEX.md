# Plans Index

**Updated**: 2026-07-16
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Remaining Work

All P0-P2 items from the plan backlog are now MERGED.
The items below are lower-priority future work.

| Priority | Item | Description | Status |
|----------|------|-------------|--------|
| P3 | Phase 8 collaboration | P2P sync, multi-user, voice-to-knowledge | OPEN |

## Completed - 2026-07-16 Session (Plan 063, PR #449)

| Plan | Description | PRs |
|------|-------------|-----|
| 063 | Advanced TRIZ: real 39x39 contradiction matrix, 40 principles with examples, interactive matrix view | 449 |

## Completed - 2026-07-16 Session (Plan 062, PR #448)

| Plan | Description | PRs |
|------|-------------|-----|
| 062 | Component consolidation: Button, FieldLabel, TextInput, Divider, ToolbarBtn, ToggleButtonGroup primitives | 448 |

## Completed - 2026-07-16 Session (Plan 061, PR #447)

| Plan | Description | PRs |
|------|-------------|-----|
| 061 | CodeMirror 6 evaluation spike: recommendation keep textarea, revisit when syntax-aware/multi-cursor needed | 447 |

## Completed - 2026-07-16 Session (Plan 060, PR #446)

| Plan | Description | PRs |
|------|-------------|-----|
| 060 | E2E test harness: Playwright — 58 tests for keyboard, a11y, CRUD, search, command palette, responsive | 446 |

## Completed - 2026-07-15 Session (Plan 059, PR #445)

| Plan | Description | PRs |
|------|-------------|-----|
| 059 | P3 perf/disclosure/locale: Intl.DateTimeFormat, settings collapsed, useCallback clearFilters | 445 |

## Completed - 2026-07-15 Session (Plan 059, PR #438)

| Plan | Description | PRs |
|------|-------------|-----|
| 059 | Missing task remediation: sidebar Math.random, stale dist cleanup, INDEX update, docs alignment | 438 |

## Completed - 2026-07-15 Session (Plan 058, PR #437)

| Plan | Description | PRs |
|------|-------------|-----|
| 058 | GOAP swarm: saffron contrast, dialog semantics, home redesign, tablet breakpoint, tests | 437 |

## Completed - 2026-07-15 Session (PR #436)

| Plan | Description | PRs |
|------|-------------|-----|
| — | Optimize useFilteredEntities selector with atomic Zustand selectors + memoization | 436 |

## Completed - 2026-07-14 Session (Plan 057, PR #435)

| Plan | Description | PRs |
|------|-------------|-----|
| 057 | Missing task remediation: graph determinism, export honesty, contrast fixes, typography | 435 |

## Completed - 2026-07-14 Session (PRs 430-433)

| Plan | Description | PRs |
|------|-------------|-----|
| 053 | Markdown editor: real formatting, safe drafts, quiet feedback, responsive modes, a11y | 430, 431 |
| 054 | Plan 053 implementation summary | 430 |
| 055 | Remaining plan 053 + UI/UX audit: reduced motion, keyboard a11y, inert control removal | 431 |
| 056 | Store subscription narrowing + typography scale tokens | 432 |
| ui-ux-audit | WCAG, responsiveness, interaction trust, rendering performance | 431, 432 |

## Completed - 2026-07-09 Session (PRs 399-400)

| Plan | Description | PRs |
|------|-------------|-----|
| 048 | Next.js migration cleanup: remove dead deps, fix configs, add tests | 399 |
| 049 | AI provider integration, encrypted export, zod schemas, BM25 retrieval | 399 |
| 050 | GOAP swarm: Next.js cleanup + feature implementation | 399 |
| 051 | Fix Vercel deployment, add Node 20+ requirement | 400 |
| 052 | PR CI failures resolved, lint warnings fixed | - |

## Completed - 2026-06 Session (PRs 289-307)

| Plan | Description | PRs |
|------|-------------|-----|
| 033 | Close 6 open issues + wire missing plan features | 305 |
| 040 | Complete export pipeline (PDF, JSON schema v1.0, MD round-trip) | 289 |
| 041-uiux | UI/UX modernization, responsiveness, feature-gap closure | 232-236 |
| 042 | Master GOAP - 4-wave swarm execution of all open plans | All |
| 041-ai | AI harness: enhanced system prompt, structured context | - |
| 043-chat | Chat unification | - |
| 043-search | Search improvements | - |
| 043-tags | Tags implementation | - |
| 044 | Import persistence | - |
| 045 | Test coverage expansion | - |
| 046 | Test coverage expansion | - |
| 047 | Master GOAP closeout | - |

## Key Metrics (2026-07-16)

| Metric | Value |
|--------|-------|
| Unit test files | 15 |
| Unit tests | 176 |
| E2E test files | 8 |
| E2E tests | 58 |
| Total tests | 234 |
| CI checks | 22/22 passing |
| LOC violations | 0 |
| Lint warnings | 0 |
| Type errors | 0 |
| Broad store subscriptions | 0 (all narrowed) |
| Reduced-motion gated components | 7/7 |
| Keyboard-operable surfaces | library, graph, mindmap |
| Dialog semantics | 3/3 overlays (command palette, export reset, right-panel delete) |
| Home view | Recent-work-first layout with relative timestamps |
| Tablet breakpoint | Right panel deferred to wide (1100px) |
| `--ink-faint` AA contrast | ✅ 4.72:1 light, 4.94:1 dark |
| `text-[9px]` remaining | 0 (all mapped to `text-badge` token) |
| Math.random() in views | 0 (replaced with seededRandom) |
| Toast-only controls | 0 (PDF/DOCX now honest disabled cards) |
| E2E coverage | keyboard, a11y, CRUD, search, command palette, responsive |

## ADR Updates (2026-07-14)

| Title | Status | Notes |
|-------|--------|-------|
| Markdown Content and Editor Engine | Accepted | Textarea validated; CodeMirror spike deferred to P3 |
| Editor Draft Persistence | Implemented | Versioned drafts in localStorage, Zod validation |
| Editor Feedback Policy | Implemented | Inline status, no routine toasts |

## Completed - Earlier Sessions

| Plan | Description | PRs |
|------|-------------|-----|
| 33 | Library view, search nav, backlinks, CLI unification | 223-231 |
| 34 | Split 4 oversized files | 226 |
| 35 | Mind map, CLI, graph, extension tests | 228, 229 |
| 36 | CLI docs, JSDoc, DB schema, search arch | 237 |
| 37 | API key encryption, SSRF fix, migration fix | 238-240 |
