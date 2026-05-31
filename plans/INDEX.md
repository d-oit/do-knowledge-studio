# Plans Index — do-knowledge-studio

**Generated**: 2026-05-27  
**Updated**: 2026-05-31  
**Source**: Multi-agent swarm analysis + GitHub issue audit (#168–#221)  
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Quick Reference

| Priority | Plan | Description | Effort | Status | PR |
|----------|------|-------------|--------|--------|-----|
| **P0** | [13-security-fixes.md](13-security-fixes.md) | XSS, API key exposure, input sanitization | 6-8h | ✅ MERGED | #200, #219 |
| **P0** | [14-bugfix-frontend.md](14-bugfix-frontend.md) | Broken nav, dead code, version sync | 4-6h | ✅ MERGED | #200 |
| **P1** | [15-config-fixes.md](15-config-fixes.md) | CI timeouts/caching, tsconfig, Dependabot | 4-6h | ✅ MERGED | #200, #217 |
| **P1** | [16-code-quality-v2.md](16-code-quality-v2.md) | Test coverage, type safety, error handling, dedup | 16-20h | ✅ MERGED | #200, #221 |
| **P2** | [17-performance-optimizations.md](17-performance-optimizations.md) | N+1, pagination, LRU cache, lazy loading | 10-14h | ✅ MERGED | #200 |
| **P2** | [18-feature-gap-closure.md](18-feature-gap-closure.md) | Entity edit, mind map, graph layouts, a11y | 12-16h | ✅ MERGED | #200 |
| **P2** | [19-db-migration-framework.md](19-db-migration-framework.md) | Schema versioning, migrate CLI, constraints | 8-12h | ✅ MERGED | #200 |
| **P3** | [20-export-enhancement.md](20-export-enhancement.md) | PNG/PDF/DOCX export, shared core dedup | 8-12h | ✅ MERGED | #200, #220 |

### Legacy Plans (Archived/Completed)

| Plan | Description | Status |
|------|-------------|--------|
| [01-critical-fixes.md](01-critical-fixes.md) | P0 fixes (any type, version, doc references) | ✅ COMPLETED |
| [02-code-quality-v1-completed.md](02-code-quality-v1-completed.md) | Original code quality plan | 📦 SUPERSEDED by 16 |
| [03-core-implementation.md](03-core-implementation.md) | CLI architecture, export, test coverage | ⏸ ON HOLD |
| [04-feature-roadmap.md](04-feature-roadmap.md) | AI Harness, claim provenance, semantic search | ⏸ ON HOLD |
| [05-documentation-overhaul.md](05-documentation-overhaul.md) | README, JSDoc, PHASES.md | ⏸ ON HOLD |
| [06-llm-provider-system.md](06-llm-provider-system.md) | OpenRouter + Kilo plugin system | ✅ COMPLETED |
| [07-github-template-alignment.md](07-github-template-alignment.md) | Architecture validation | ✅ COMPLETED |
| [08-perplexity-removal.md](08-perplexity-removal.md) | Perplexity deletion | ✅ COMPLETED |
| [09-ui-style-alignment.md](09-ui-style-alignment.md) | Multi-mode atmospheric UI | ⏸ ON HOLD |
| [10-implementation-audit-v1-completed.md](10-implementation-audit-v1-completed.md) | Original implementation audit | 📦 SUPERSEDED by 13-20 |
| [11-expansion-roadmap.md](11-expansion-roadmap.md) | P2P sync, synthesis, voice | ⏸ ON HOLD |
| [12-doc-resolver-integration.md](12-doc-resolver-integration.md) | Web doc resolver for RAG | ⏸ ON HOLD |
| [12-doc-resolver-implementation-roadmap.md](12-doc-resolver-implementation-roadmap.md) | Doc resolver implementation details | ⏸ ON HOLD |

## GOAP Execution Order — ✅ ALL MERGED (PR #200)

```
Wave 1 (P0 — PARALLEL) ──→ ✅ MERGED
  ├─ 13-security-fixes.md (G-SECURITY)
  └─ 14-bugfix-frontend.md (G-STABILITY)
      ↓
Wave 2 (P1 — SEQUENTIAL) ──→ ✅ MERGED
  ├─ 15-config-fixes.md (G-CONFIG)
  └─ 16-code-quality-v2.md (G-QUALITY)
      ↓
Wave 3 (P2 — PARALLEL) ──→ ✅ MERGED
  ├─ 17-performance-optimizations.md (G-PERFORMANCE)
  ├─ 18-feature-gap-closure.md (G-FEATURES)
  └─ 19-db-migration-framework.md (G-MIGRATE)
      ↓
Wave 4 (P3) ──→ ✅ MERGED
  └─ 20-export-enhancement.md (G-EXPORT)
```

## Health Scores (Updated 2026-05-31 — Post PR #221)

| Category | Score | Trend | Notes |
|----------|-------|-------|-------|
| Architecture | 85/100 | ✅ Stable | Validated by github-template-ai-agents |
| Implementation Completeness | 90/100 | ⬆️ Up from 85 | All 8 plans implemented + 5 open issues closed |
| Code Quality | 90/100 | ⬆️ Up from 85 | 296 tests (up from 244), export dedup, type safety |
| Documentation | 92/100 | ⬆️ Up from 85 | 30 doc issues fixed, security model documented |
| Security | 92/100 | ⬆️ Up from 85 | VITE_ audit script, local-first security docs |

### Fix Plans (Pre-existing Issues)

| Plan | Description | Status | PR |
|------|-------------|--------|-----|
| [002-e2e-prod-build-tdz.md](002-e2e-prod-build-tdz.md) | Production build TDZ — circular dep, forward const ref, schema ordering | ✅ RESOLVED | #209 |
| [003-eslint-pre-existing-cleanup.md](003-eslint-pre-existing-cleanup.md) | 141 ESLint errors (mechanical, type, a11y, hooks) | ✅ RESOLVED | #209 |

### Session Work (2026-05-31 — Swarm Agent Execution)

| PR | Issue | Description | Status |
|----|-------|-------------|--------|
| #216 | — | Security: export CSP & sanitization | ✅ MERGED |
| #217 | #194 | CI: Playwright cache, pip cache, concurrency group | ✅ MERGED |
| #218 | #196 | Docs: 30 inconsistencies and stale references fixed | ✅ MERGED |
| #219 | #170 | Security: local-first security model, VITE_ audit script | ✅ MERGED |
| #220 | #191 | Refactor: extract shared fetchAllExportData, fix N+1 query | ✅ MERGED |
| #221 | #193 | Tests: 52 new test cases (244→296 total) | ✅ MERGED |

## Key Constraints
1. **AGENTS.md is single source of truth** — Do NOT modify GEMINI.md or QWEN.md
2. **Local-first ONLY** — No required backend
3. **Strict TypeScript** — NO `any` (HARD RULE)
4. **Markdown is NOT canonical truth** — Use only for export/import
5. **Design Tokens ONLY** — Use CSS variables from `src/styles/index.css`

## ADR Index

| # | Title | Status | Notes |
|---|-------|--------|-------|
| 001 | SQLite over Markdown as Truth | ✅ Accepted | Original |
| 002 | XSS Prevention in Export Paths | ✅ Implemented | DOMPurify + shared escapeHtml |
| 003 | API Key Isolation from VITE_ Env Vars | ✅ Accepted | Audit script, security docs, ADR updated |
| 004 | Database Migration System | ✅ Implemented | Migration runner, CLI commands |
| 005 | Error Handling Architecture | ✅ Implemented | AppError class, ErrorBoundaries |
| 006 | Shared Export Core Deduplication | ✅ Implemented | fetchAllExportData, N+1 fix, type alignment |
| 007 | do-web-doc-resolver Integration | 📝 Proposed | Future work |
| 008 | Rolldown Circular Dependency Resolution | ✅ Implemented | #209 — core.ts extraction, const ordering |
| 009 | Staged ESLint Rule Enforcement | ✅ Implemented | #209 — typed workers, void-wrap, vi.mocked |

## Verification Commands
```bash
# Check all plans exist
ls -1 plans/*.md | wc -l
# Should return 30+

# Verify no QUICKSTART.md references
grep -r "QUICKSTART" . --include="*.sh" --include="*.md" --include="*.yml" --include="*.yaml"

# Run quality gates
pnpm test && pnpm run typecheck && pnpm run lint

# Check for type safety violations
grep -r "as any" src/ --include="*.ts" --include="*.tsx" || echo "✅ No 'as any'"
grep -r "as unknown as" src/ --include="*.ts" --include="*.tsx" || echo "✅ No 'as unknown as'"
```
