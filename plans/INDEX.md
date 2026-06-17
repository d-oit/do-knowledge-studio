# Plans Index — do-knowledge-studio

**Generated**: 2026-05-27  
**Updated**: 2026-06-12
**Source**: 6-agent parallel swarm analysis + GitHub issue audit (#168–#240) + open issues (#280-#289) + all PRs merged (#292-#307)
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Quick Reference — Active Plans

| Priority | Plan | Description | Effort | Status | Issues |
|----------|------|-------------|--------|--------|--------|
| **P0** | [33-post-swarm-critical-features.md](33-post-swarm-critical-features.md) | Library view, search nav, backlinks, CLI unification, Chat→LLM, toolbar, undo/redo | 20-28h | ✅ MERGED | #223–#231, #292, #293, #305, #307 |
| **P1** | [34-architecture-hygiene.md](34-architecture-hygiene.md) | Split 4 oversized files (repository, GraphView, AIHarness, search) | 16-20h | 📝 OPEN | #226 |
| **P1** | [35-test-coverage-expansion.md](35-test-coverage-expansion.md) | Mind map, CLI, graph, extension, E2E tests | 20-28h | 📝 OPEN | #228, #229 |
| **P1** | [36-documentation-overhaul.md](36-documentation-overhaul.md) | CLI docs, JSDoc, DB schema, search arch, onboarding, LLM setup, deployment | 12-16h | 📝 OPEN | #237 |
| **P1** | [37-security-quality-hardening.md](37-security-quality-hardening.md) | API key encryption, SSRF fix, migration fix, snapshot validation | 8-12h | 📝 OPEN | #238–#240 |
| **P0** | [033-goap-open-issues-prs-2026-06-11.md](033-goap-open-issues-prs-2026-06-11.md) | Close 6 open issues + wire missing plan features | 8-12h | ✅ MERGED | #305 |
| **P1** | [040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md](040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md) | Complete export pipeline (PDF, JSON schema v1.0, MD round-trip) + resolve red PRs | 12-18h | ✅ MERGED | #289 |

## Quick Reference — Completed Plans

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
| **P0** | [033-goap-open-issues-prs-2026-06-11.md](033-goap-open-issues-prs-2026-06-11.md) | LLM providers, chat persistence, toolbar, backlinks, undo/redo, context window | 8-12h | ✅ MERGED | #305 |
| **P0** | PR #292 — Mind map ↔ knowledge graph sync | Bidirectional sync with SyncToggle | — | ✅ MERGED | #292 |
| **P0** | PR #293 — Agentic tool-calling loop | search_knowledge, create_note, add_graph_node tools | — | ✅ MERGED | #293 |
| **P0** | PR #307 — AI extraction loading state | UX improvement for entity extraction | — | ✅ MERGED | #307 |
| **P1** | PRs #299–#303 — Dependency bumps | docx, react, commander, lucide-react, @types/node | — | ✅ MERGED | #299–#303 |

## New GitHub Issues (2026-05-31 — Swarm Analysis)

| Issue | Title | Priority | Labels | Plan |
|-------|-------|----------|--------|------|
| #223 | Build Library/Entity Browser view | High | enhancement, feature, jules | 33.1 |
| #224 | Add backlinks / bidirectional linking | High | enhancement, feature, jules | 33.3 |
| #225 | Unify CLI and browser database | High | enhancement, bug, jules | 33.4 |
| #226 | Split 4 oversized files (repository, GraphView, AIHarness, search) | High | refactor, jules | 34 |
| #227 | Wire Chat component to LLM providers | High | enhancement, feature, jules | 33.5 |
| #228 | Add comprehensive unit tests for mind map, CLI, and graph | High | tests, jules | 35 |
| #229 | Expand E2E tests for critical user journeys | High | tests, jules | 35.6 |
| #230 | Expand editor toolbar with formatting options | High | enhancement, feature, jules | 33.6 |
| #231 | Add undo/redo across editor, graph, and mind map | High | enhancement, feature, jules | 33.7 |
| #232 | Add graph filtering and node search | High | enhancement, feature, jules | — |
| #233 | Add import functionality for markdown, JSON, OPML | High | enhancement, feature, jules | — |
| #234 | Add tags / categories system | High | enhancement, feature, jules | — |
| #235 | Add entity version history | High | enhancement, feature, jules | — |
| #236 | Improve static export to multi-page site | High | enhancement, feature, jules | — |
| #237 | Create comprehensive documentation suite | High | documentation, jules | 36 |
| #238 | Encrypt API keys at rest and fix SSRF | High | security, jules | 37 |
| #239 | Fix browser migration fallback loading only first file | High | bug, jules | 37.3 |
| #240 | Add Zod validation for graph snapshot loading | High | bug, jules | 37.4 |

## GOAP Execution Order — Next Wave

```
Wave 1 (P0 — PARALLEL) ──→ 📝 OPEN
  ├─ 33-post-swarm-critical-features.md (G-FEATURES-V2)
  │   ├─ 33.2 Search → Editor navigation (quick win, 0.5h)
  │   ├─ 33.1 Library/Entity Browser view (6-8h)
  │   ├─ 33.3 Backlinks/bidirectional linking (4-6h)
  │   ├─ 33.4 CLI database unification (4-6h)
  │   ├─ 33.5 Wire Chat to LLM (2-3h)
  │   ├─ 33.6 Expand editor toolbar (2-3h)
  │   └─ 33.7 Add undo/redo (3-4h)
  └─ 37-security-quality-hardening.md (G-SECURITY-V2)
      ├─ 37.1 API key encryption (3-4h)
      ├─ 37.2 SSRF fix (1-2h)
      ├─ 37.3 Browser migration fix (1h)
      ├─ 37.4 Snapshot validation (1h)
      └─ 37.5 Silent catch logging (1-2h)
      ↓
Wave 2 (P1 — PARALLEL) ──→ 📝 OPEN
  ├─ 34-architecture-hygiene.md (G-ARCHITECTURE)
  │   ├─ 34.5 IRepository interface (3-4h) — do first
  │   ├─ 34.1 Split repository.ts (6-8h)
  │   ├─ 34.2 Split GraphView.tsx (5-6h)
  │   ├─ 34.3 Split AIHarness.tsx (4-5h)
  │   └─ 34.4 Split search.ts (3-4h)
  ├─ 35-test-coverage-expansion.md (G-TESTING)
  │   ├─ 35.1 Mind map tests (4-5h)
  │   ├─ 35.2 CLI tests (5-6h)
  │   ├─ 35.3 Graph tests (4-5h)
  │   ├─ 35.4 Editor extension tests (3-4h)
  │   ├─ 35.5 Quick win tests (2-3h)
  │   ├─ 35.6 E2E test expansion (4-6h)
  │   └─ 35.7 Raise coverage thresholds (1h)
  └─ 36-documentation-overhaul.md (G-DOCS)
      ├─ 36.9 Fix VERSION sync (0.5h) — do first
      ├─ 36.1 CLI reference (2-3h)
      ├─ 36.2 JSDoc for components (3-4h)
      ├─ 36.3 Database schema docs (2-3h)
      ├─ 36.4 Search architecture docs (1-2h)
      ├─ 36.5 Developer onboarding guide (2-3h)
      ├─ 36.6 LLM setup guide (1-2h)
      ├─ 36.7 Deployment guide (1-2h)
      └─ 36.8 Repository API docs (1-2h)
```

## Legacy Plans (Archived/Completed)

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

## Health Scores (Updated 2026-05-31 — Post Swarm Analysis)

| Category | Score | Trend | Notes |
|----------|-------|-------|-------|
| Architecture | 80/100 | ⬇️ Down from 85 | 4 files exceed 500 LOC; singleton repository untestable |
| Implementation Completeness | 75/100 | ⬇️ Down from 90 | Search→editor nav broken; Chat not wired to LLM; no backlinks |
| Code Quality | 85/100 | ⬇️ Down from 90 | 14 silent catch blocks; magic numbers; duplicate escapeHtml |
| Documentation | 70/100 | ⬇️ Down from 92 | 9 high-priority gaps: CLI docs, JSDoc, DB schema, onboarding |
| Security | 85/100 | ⬇️ Down from 92 | API keys in plaintext; SSRF; no URL validation |
| Test Coverage | 60/100 | ⬇️ Down from 85 | Mind map, CLI, graph, extensions: zero tests |

## Key Constraints
1. **AGENTS.md is single source of truth** — Do NOT modify GEMINI.md or QWEN.md
2. **Local-first ONLY** — No required backend
3. **Strict TypeScript** — NO `any` (HARD RULE)
4. **Markdown is NOT canonical truth** — Use only for export/import
5. **Design Tokens ONLY** — Use CSS variables from `src/styles/index.css`
6. **Max 500 LOC per file** — HARD RULE (4 violations currently)

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
# Should return 40+

# Verify no QUICKSTART.md references
grep -r "QUICKSTART" . --include="*.sh" --include="*.md" --include="*.yml" --include="*.yaml"

# Run quality gates
pnpm test && pnpm run typecheck && pnpm run lint

# Check for type safety violations
grep -r "as any" src/ --include="*.ts" --include="*.tsx" || echo "✅ No 'as any'"
grep -r "as unknown as" src/ --include="*.ts" --include="*.tsx" || echo "✅ No 'as unknown as'"

# Check for 500 LOC violations
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 500 {print $0}'
```
ignment |
| 007 | do-web-doc-resolver Integration | 📝 Proposed | Future work |
| 008 | Rolldown Circular Dependency Resolution | ✅ Implemented | #209 — core.ts extraction, const ordering |
| 009 | Staged ESLint Rule Enforcement | ✅ Implemented | #209 — typed workers, void-wrap, vi.mocked |

## Verification Commands
```bash
# Check all plans exist
ls -1 plans/*.md | wc -l
# Should return 40+

# Verify no QUICKSTART.md references
grep -r "QUICKSTART" . --include="*.sh" --include="*.md" --include="*.yml" --include="*.yaml"

# Run quality gates
pnpm test && pnpm run typecheck && pnpm run lint

# Check for type safety violations
grep -r "as any" src/ --include="*.ts" --include="*.tsx" || echo "✅ No 'as any'"
grep -r "as unknown as" src/ --include="*.ts" --include="*.tsx" || echo "✅ No 'as unknown as'"

# Check for 500 LOC violations
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 500 {print $0}'
```
