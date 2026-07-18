# GOAP: Goal-Oriented Action Plan — do-knowledge-studio

**Generated**: 2026-05-26  
**Updated**: 2026-05-31  
**Source**: GitHub issue analysis (#168–#221) + plans/ gap analysis  
**Method**: Goal-Oriented Action Planning with dependency-driven action chains

## Goal Hierarchy

```
G-SECURITY ──→ G-STABILITY ──→ G-CONFIG ──→ G-QUALITY ──→ G-FEATURES
                                    ↓                          ↓
                              G-MIGRATE                   G-PERFORMANCE
                                                              ↓
                                                          G-EXPORT
```

| ID | Goal | Priority | Est. Effort | Plan |
|----|------|----------|-------------|------|
| G-SECURITY | Zero security vulnerabilities | **P0** | 6-8h | 13-security-fixes |
| G-STABILITY | All functional bugs resolved | **P0** | 4-6h | 14-bugfix-frontend |
| G-CONFIG | Build/CI/infrastructure integrity | **P1** | 4-6h | 15-config-fixes |
| G-QUALITY | Code quality meets AGENTS.md standards | **P1** | 16-20h | 16-code-quality-v2 |
| G-MIGRATE | Safe schema evolution | **P2** | 8-12h | 19-db-migration-framework |
| G-PERFORMANCE | Scalable performance for large KBs | **P2** | 10-14h | 17-performance-optimizations |
| G-FEATURES | Core feature parity | **P2** | 12-16h | 18-feature-gap-closure |
| G-EXPORT | Enhanced export capabilities | **P3** | 8-12h | 20-export-enhancement |

---

## G-SECURITY: Zero Security Vulnerabilities

**Priority**: P0 | **Est. Effort**: 6-8h | **Plan**: 13-security-fixes

### Preconditions
- Repository and schema knowledge (existing)
- Understanding of current export flows (both browser and CLI)

### Effects
- XSS eliminated in all export paths (browser + CLI)
- API keys isolated from `VITE_` environment variables
- Input sanitization applied to all user-provided content in exports
- Security tests for XSS prevention

### Actions
| # | Action | Effort | ADR |
|---|--------|--------|-----|
| A1 | Escape HTML in `ExportPanel.tsx` static site export | 1h | ADR-002 |
| A2 | Escape HTML in `cli/index.ts` site export | 1h | ADR-002 |
| A3 | Create shared `escapeHtml()` / DOMPurify utility | 1h | ADR-002 |
| A4 | Migrate API keys from `VITE_` env to runtime config + IndexedDB | 2h | ADR-003 |
| A5 | Add security tests for XSS vectors | 1h | ADR-002 |
| A6 | Audit all `VITE_` env usage in codebase | 0.5h | ADR-003 |

### Success Criteria
- [x] No unescaped user content in exported HTML (browser or CLI)
- [x] No `VITE_` environment variables expose API keys
- [x] Security test suite passes for XSS vectors
- [x] `npm audit` / `pnpm audit` shows zero critical vulnerabilities

---

## G-STABILITY: All Functional Bugs Resolved

**Priority**: P0 | **Est. Effort**: 4-6h | **Plan**: 14-bugfix-frontend

### Preconditions
- G-SECURITY addressed (or parallel — no dependency)

### Effects
- "Library" sidebar nav item navigates to a working view or is removed
- "Create new entity" button in Chat triggers entity creation flow
- `GraphInspector` component is either rendered or removed (no dead code)
- All version references are consistent

### Actions
| # | Action | Effort |
|---|--------|--------|
| B1 | Wire up "Create new entity" button in Chat.tsx `NoResultsState` | 1h |
| B2 | Fix or remove "Library" sidebar nav in `SidebarNav.tsx` | 0.5h |
| B3 | Remove or render `GraphInspector` component | 0.5h |
| B4 | Fix MIGRATION.md version badge to match VERSION file | 0.5h |
| B5 | Sync CLI `--version` with VERSION file (auto-read) | 1h |
| B6 | Fix pre-commit-hook.sh QUICKSTART.md reference | 0.5h |
| B7 | Fix broken discussions URL in ISSUE_TEMPLATE config | 0.5h |

### Success Criteria
- [x] All 7 bugs verified fixed via E2E or unit test
- [x] No dead code components in bundle
- [x] All version references match `VERSION` file

---

## G-CONFIG: Build/CI/Infrastructure Integrity

**Priority**: P1 | **Est. Effort**: 4-6h | **Plan**: 15-config-fixes

### Preconditions
- None (independent of other goals)

### Effects
- CI jobs have `timeout-minutes: 15` to prevent hung job waste
- pnpm store + Playwright browsers cached in CI
- `tsconfig.app.json` only includes browser types (no `node`)
- Dependabot configured only for existing ecosystems (npm, GitHub Actions)
- `create-jules-issues.yml` disabled or removed

### Actions
| # | Action | Effort |
|---|--------|--------|
| C1 | Add `timeout-minutes: 15` to all CI jobs | 0.5h |
| C2 | Add pnpm store + Playwright caching in CI workflows | 1h |
| C3 | Fix `tsconfig.app.json` types (`node` → remove) | 0.5h |
| C4 | Fix Dependabot config for correct ecosystems | 0.5h |
| C5 | Disable/remove `create-jules-issues.yml` | 0.5h |
| C6 | Add path filters for docs-only CI skipping | 0.5h |

### Success Criteria
- [x] All CI workflows have explicit `timeout-minutes`
- [x] Cache hit reduces CI run time by ≥40%
- [x] `tsc --noEmit` passes with browser-only types
- [x] Dependabot only opens PRs for existing ecosystems

---

## G-QUALITY: Code Quality Meets AGENTS.md Standards

**Priority**: P1 | **Est. Effort**: 16-20h | **Plan**: 16-code-quality-v2

### Preconditions
- G-CONFIG complete (CI needs to be reliable for quality gates)

### Effects
- Test coverage ≥50% (milestone toward 80%)
- Zero `as any`, `as unknown as` double casts, or `eslint-disable @typescript-eslint/no-unsafe-*`
- Per-feature ErrorBoundaries isolating crashes
- `AppError` class used consistently for all error paths
- Deduplicated export logic shared between CLI and browser

### Actions
| # | Action | Effort |
|---|--------|--------|
| Q1 | Add repository tests — 80% coverage for `repository.ts` | 3h |
| Q2 | Add UI component tests (Chat, ExportPanel, AIHarness) | 3h |
| Q3 | Add CLI integration tests | 2h |
| Q4 | Eliminate all `as any` in production code | 2h |
| Q5 | Eliminate all `as unknown as` double casts | 2h |
| Q6 | Remove file-level `eslint-disable @typescript-eslint/no-unsafe-*` | 1h |
| Q7 | Add Zod schemas for all runtime-parsed data | 2h |
| Q8 | Implement per-feature ErrorBoundaries in `App.tsx` | 1h |
| Q9 | Implement `AppError` class with error codes + user messages | 1.5h |
| Q10 | Extract shared export logic into `src/lib/export-core.ts` | 2h |

### Success Criteria
- [x] Test coverage ≥50% (lines, branches, functions)
- [x] `grep "as any" src/ --include="*.ts" --include="*.tsx"` returns zero
- [x] `grep "as unknown as" src/ --include="*.ts" --include="*.tsx"` returns zero
- [x] No file-level ESLint TS safety disables remaining
- [x] Feature crash only affects that feature, not entire app
- [x] ExportPanel and CLI use shared export core

---

## G-MIGRATE: Safe Schema Evolution

**Priority**: P2 | **Est. Effort**: 8-12h | **Plan**: 19-db-migration-framework

### Preconditions
- G-CONFIG complete (CI reliable for migration tests)

### Effects
- `schema_version` table tracks applied migrations on startup
- `db:migrate`, `db:rollback`, `db:status` CLI commands
- Automatic migration on app startup
- Backup before migration
- Rollback support for last migration

### Actions
| # | Action | Effort |
|---|--------|--------|
| M1 | Add `schema_version` table to `public/db/schema.sql` | 0.5h |
| M2 | Create migration runner in `src/db/migrate.ts` | 2h |
| M3 | Add CLI `db:migrate`, `db:rollback`, `db:status` commands | 2h |
| M4 | Add `db:backup` CLI command | 1h |
| M5 | Wire auto-migration into app startup (before `refreshData`) | 1h |
| M6 | Write tests for migration idempotency and rollback | 2h |

### Success Criteria
- [x] New `schema_version` table exists after first run
- [x] Running `db:migrate` applies pending migrations
- [x] `db:rollback` reverts last migration
- [x] Auto-migration on app start runs without blocking UI > 500ms
- [x] Backup file created before each destructive migration
- [x] Tests verify up/down migration is lossless

---

## G-PERFORMANCE: Scalable Performance

**Priority**: P2 | **Est. Effort**: 10-14h | **Plan**: 17-performance-optimizations

### Preconditions
- G-QUALITY complete (refactored code before optimizing)

### Effects
- Cursor-based pagination for entity/link queries
- N+1 queries eliminated in export
- `oramaIdMap` has LRU eviction with max size
- Chat submit debounced (300ms)
- Graph edges diffed instead of cleared/re-added
- `@huggingface/transformers` loaded lazily
- Mention menu virtualized with `@tanstack/react-virtual`

### Actions
| # | Action | Effort |
|---|--------|--------|
| P1 | Add cursor-based pagination to `getAllEntities()` and `getAllLinks()` | 2h |
| P2 | Add `getAllClaimsWithNotes()` batch query to repository | 1h |
| P3 | Replace N+1 export loops with batch query | 1h |
| P4 | Add LRU eviction to `oramaIdMap` with 10k max | 1h |
| P5 | Add 300ms debounce to Chat `handleSend` | 0.5h |
| P6 | Diff graph edges in `GraphView.tsx` instead of clear/re-add | 2h |
| P7 | Lazy-load `@huggingface/transformers` on first semantic search | 1h |
| P8 | Virtualize entity mention menu | 2h |

### Success Criteria
- [x] Export with 500 entities completes in <1s (was N+1 seconds)
- [x] `oramaIdMap` evicts entries beyond 10k limit
- [x] Chat sends are debounced — rapid clicks only trigger one search
- [x] Graph re-render with 1000 edges < 100ms (was clear/re-add)
- [x] Semantic search only loads transformers.js on first use
- [x] Mention menu renders 5000 entities without jank

---

## G-FEATURES: Core Feature Parity

**Priority**: P2 | **Est. Effort**: 12-16h | **Plan**: 18-feature-gap-closure

### Preconditions
- G-QUALITY complete (quality baseline before adding features)

### Effects
- Entity editing and deletion available in UI
- Mind map node editing (add, rename, delete)
- Force-directed and hierarchical graph layout algorithms
- Keyboard-accessible graph navigation
- Accessibility (a11y) improvements throughout

### Actions
| # | Action | Effort |
|---|--------|--------|
| F1 | Add edit button + inline editing for entity name/type/description | 2h |
| F2 | Add delete button + confirmation dialog for entities | 1.5h |
| F3 | Keyboard shortcut (Delete key) for entity deletion with confirmation | 1h |
| F4 | Add mind map node editing (click-to-rename, context menu) | 3h |
| F5 | Add force-directed layout (Sigma.js built-in) options | 2h |
| F6 | Add hierarchical layout via dagre or similar | 2h |
| F7 | Implement keyboard graph navigation (arrow keys, tab, enter) | 2h |
| F8 | Accessibility audit + fix WCAG 2.2 AA violations | 3h |

### Success Criteria
- [x] Entity CRUD fully works in UI (create, read, update, delete)
- [x] Mind map nodes editable via click and context menu
- [x] Graph layout toggle switches between force-directed and hierarchical
- [x] Graph navigable entirely via keyboard
- [x] No WCAG 2.2 AA violations in automated audit

---

## G-EXPORT: Enhanced Export Capabilities

**Priority**: P3 | **Est. Effort**: 8-12h | **Plan**: 20-export-enhancement

### Preconditions
- G-FEATURES complete, G-QUALITY complete

### Effects
- Graph export as PNG/image via Sigma.js `toCanvas`
- PDF export via browser print-to-PDF or jsPDF
- DOCX export via docx.js library
- PNG export for graph views

### Actions
| # | Action | Effort |
|---|--------|--------|
| X1 | Add graph PNG export using Sigma.js `renderer.toCanvas()` | 2h |
| X2 | Add PDF export (HTML-to-PDF via browser print) | 2h |
| X3 | Add DOCX export via `docx` npm package | 3h |
| X4 | Add UI controls for format selection in ExportPanel | 1h |

### Success Criteria
- [x] Graph exports as 1080p PNG with transparent background option
- [x] PDF export preserves entity/claim structure
- [x] DOCX export produces valid `.docx` files
- [x] All export buttons show progress and completion states

---

## Dependency Graph (Full)

```
G-SECURITY ──────────────→ G-STABILITY
     ↓
G-CONFIG ──→ G-MIGRATE
     ↓
G-QUALITY ──→ G-PERFORMANCE
     ↓              ↓
G-FEATURES ──→ G-EXPORT
```

## Execution Strategy

1. **Wave 1 (P0, parallel)**: G-SECURITY + G-STABILITY
   - Security is highest risk; bugs are user-facing friction
   - These can run in parallel as they touch different code paths
   - Estimated: 2-3 days

2. **Wave 2 (P1, sequential)**: G-CONFIG → G-QUALITY
   - CI must be reliable before quality gates can be trusted
   - G-QUALITY is the largest effort and unlocks all downstream goals
   - Estimated: 4-5 days

3. **Wave 3 (P2, partially parallel)**: G-MIGRATE + G-PERFORMANCE + G-FEATURES
   - G-MIGRATE depends on G-CONFIG
   - G-PERFORMANCE depends on G-QUALITY
   - G-FEATURES depends on G-QUALITY
   - G-MIGRATE and G-PERFORMANCE can run in parallel
   - G-FEATURES can begin when G-QUALITY is ~60% complete
   - Estimated: 5-7 days

4. **Wave 4 (P3)**: G-EXPORT
   - Depends on G-FEATURES + G-QUALITY
   - Estimated: 2-3 days

**Total estimated effort**: 60-85 hours across all goals

---

## References
- [ADR-002: XSS Prevention Strategy](./ADRs/002-security-export.md)
- [ADR-003: API Key Isolation](./ADRs/003-vite-env-security.md)
- [ADR-004: Database Migration System](./ADRs/004-db-migration-system.md)
- [ADR-005: Error Handling Architecture](./ADRs/005-error-handling.md)
- [ADR-006: Export Core Deduplication](./ADRs/006-export-deduplication.md)
- [INDEX.md](./INDEX.md) — updated table of contents
- [PHASES.md](./PHASES.md) — aligned phase structure
