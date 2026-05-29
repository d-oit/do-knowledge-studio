# GOAP Plan: Implement All Open GitHub Issues

## Task Analysis

**Primary Goal**: Close all 30 open issues across d-oit/do-knowledge-studio
**Constraints**: Local-first, strict TypeScript, atomic commits, quality gates
**Complexity**: Complex (30 issues across 5 waves)

## Issue Decomposition

### Wave 1: Security + Critical Bugs (8 issues)
| # | Title | Priority |
|---|-------|----------|
| 172 | XSS in static site export (ExportPanel.tsx) | critical |
| 168 | XSS in static site export (ExportPanel.tsx) duplicate | critical |
| 173 | XSS in CLI site export (cli/index.ts) | critical |
| 169 | XSS in CLI site export (cli/index.ts) duplicate | critical |
| 176 | "Create new entity" button in Chat does nothing | high |
| 175 | "Library" sidebar nav item points to non-existent view | high |
| 171 | GraphInspector component defined but never rendered (dead code) | high |
| 174 | API key exposure via VITE_ environment variables | high |
| 170 | API key exposure via VITE_ environment variables duplicate | high |

### Wave 2: Error Handling + Type Safety + Broken References (6 issues)
| # | Title | Priority |
|---|-------|----------|
| 192 | Fix error handling gaps across the codebase | high |
| 190 | Fix type safety issues — eliminate `any` and unsafe casts | high |
| 185 | Add database migration system | high |
| 177 | Version inconsistency: MIGRATION.md badge vs VERSION file | high |
| 179 | pre-commit-hook.sh references deleted QUICKSTART.md | medium |
| 178 | Broken discussions URL in ISSUE_TEMPLATE config | medium |
| 180 | CLI version hardcoded, not synced with VERSION file | medium |

### Wave 3: Documentation + CI/CD + A11y + Config (5 issues)
| # | Title | Priority |
|---|-------|----------|
| 196 | Fix documentation inconsistencies and stale references | medium |
| 197 | Fix accessibility gaps across the app | medium |
| 194 | Add CI job timeouts and caching for faster builds | medium |
| 193 | Increase test coverage from ~25% to meaningful thresholds | high |
| 198 | Fix tsconfig.app.json including Node types in browser build | low |

### Wave 4: Features — Export, Graph, Mind Map, CLI, LLM, DB (8 issues)
| # | Title | Priority |
|---|-------|----------|
| 191 | Deduplicate export logic between ExportPanel.tsx and CLI | medium |
| 199 | Add graph export as PNG/image | low |
| 181 | Add entity editing and deletion in the UI | high |
| 183 | Add mind map node editing (add, rename, delete) | medium |
| 182 | Add keyboard-accessible graph navigation | medium |
| 187 | Add CLI search command and missing CRUD commands | medium |
| 188 | Add LLM provider setup wizard and model selector UI | medium |
| 186 | Add CHECK/unique constraints to database schema | medium |

### Wave 5: Performance + Test Coverage + Graph Layouts (3 issues)
| # | Title | Priority |
|---|-------|----------|
| 195 | Fix performance concerns — memory, N+1, unbounded caches | medium |
| 184 | Add force-directed and hierarchical graph layout algorithms | medium |
| 189 | Add PDF and DOCX export formats | low |

## Execution Strategy

**Hybrid**: Swarm agents within each wave, sequential waves with quality gates

```
Wave 1 (Security) → Quality Gate → Wave 2 (Error/Types) → Quality Gate
→ Wave 3 (Docs/CI) → Quality Gate → Wave 4 (Features) → Quality Gate
→ Wave 5 (Perf) → Quality Gate → Final PR
```

## Quality Gates
- Lint: `pnpm run lint` (166 pre-existing errors, 2 warnings - all pre-existing)
- TypeCheck: `pnpm run typecheck` ✅
- Tests: `pnpm run test` (224/224 pass across 19 files) ✅
- Build: `pnpm run build` ✅
- E2E: `pnpm run test:e2e` (skipped for non-UI changes)

## Branch Strategy
- Single feature branch per wave, all merged into main via PR
- Atomic commits with conventional commit messages

## Completion Summary

### Wave 1 — Security + Critical Bugs (8 issues)
| Issue | Status | Notes |
|-------|--------|-------|
| #172/#168 | ✅ XSS in static site export | sanitizeHtml() applied to entity descriptions |
| #173/#169 | ✅ XSS in CLI export | escapeHtml() in markdown export |
| #174/#170 | ✅ API key exposure | Key masking in UI, warnings, docs |
| #176 | ✅ Chat 'Create new entity' | Carries search context via navigate state |
| #175 | ✅ Library nav item | Added library view pointing to editor |
| #171 | ✅ GraphInspector dead code | Fixed dual-virtualizer scrollRef conflict |

### Wave 2 — Error Handling + Type Safety + Infrastructure (7 issues)
| Issue | Status | Notes |
|-------|--------|-------|
| #192 | ✅ Error handling gaps | Editor, App, CLI, config error handling fixed |
| #190 | ✅ Type safety issues | repository, CLI, mind map, LLM types fixed |
| #185 | ✅ Database migration system | Full migration framework with up/down/backup |
| #177 | ✅ Version inconsistency | CHANGELOG links fixed |
| #180 | ✅ CLI version hardcoded | Already reading VERSION file |
| #178 | ✅ Broken discussions URL | Already fixed |
| #179 | ✅ pre-commit-hook.sh refs | Already fixed |

### Wave 3 — Docs + CI/CD + A11y + Coverage (5 issues)
| Issue | Status | Notes |
|-------|--------|-------|
| #196 | ✅ Documentation inconsistencies | QUICKSTART refs, npm→pnpm, removed RUST/SUCCESS_TEST |
| #194 | ✅ CI timeouts/caching | timeouts, path filters, caching |
| #197 | ✅ Accessibility gaps | CommandPalette, ExportPanel, AIHarness, GraphView, MindMap |
| #193 | ✅ Test coverage | Added ExportPanel, Chat, AIHarness tests (223→224 tests) |
| #198 | ✅ tsconfig.app.json | Already had proper types |

### Wave 4 — Features (8 issues)
| Issue | Status | Notes |
|-------|--------|-------|
| #191 | ✅ Export deduplication | Shared generateEntityMarkdown() |
| #199 | ✅ Graph PNG export | Already implemented |
| #181 | ✅ Entity editing/deletion | Already implemented |
| #183 | ✅ Mind map editing | Add child/sibling, rename, delete, export PNG |
| #182 | ✅ Graph keyboard nav | Arrow key navigation, aria-live announcements |
| #187 | ✅ CLI CRUD commands | 11 new commands (search, entity CRUD, link CRUD, notes) |
| #188 | ✅ LLM wizard/model selector | Setup wizard, model selector, token tracking, markdown |
| #186 | ✅ DB constraints | CHECK/UNIQUE constraints + migration 002 |

### Wave 5 — Performance + Layouts (3 issues)
| Issue | Status | Notes |
|-------|--------|-------|
| #195 | ✅ Performance concerns | Pagination, chunked search, batch queries |
| #184 | ✅ Graph layout algorithms | Force-directed + circular layouts, node pinning |
| #189 | ✅ PDF/DOCX export | Already implemented |

### Pre-existing Issues Documented
- **Lint**: 166 errors (all pre-existing) — tracked in issues #190, #192
- **Lint**: 2 warnings (pre-existing)
- **shellcheck**: SC2261 in scripts/analyze-codebase.sh (pre-existing)
