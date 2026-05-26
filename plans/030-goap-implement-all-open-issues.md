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
- Lint: `pnpm run lint`
- TypeCheck: `pnpm run typecheck`
- Tests: `pnpm run test`
- Build: `pnpm run build`
- E2E: `pnpm run test:e2e`

## Branch Strategy
- One feature branch per wave merged into main via PR
- Atomic commits with conventional commit messages
