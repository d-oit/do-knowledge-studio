# Plans Index — do-knowledge-studio

**Generated**: 2026-05-27  
**Updated**: 2026-07-12
**Source**: 6-agent parallel swarm analysis + GitHub issue audit (#168–#240) + open issues (#280-#289) + all PRs merged (#292-#307) + 3-agent UI/UX/feature-gap analysis (plan 041, ADRs 013–016) + 4-wave master GOAP swarm execution (plan 042, 2026-06-22) + Next.js cleanup & feature implementation (plans 048-049, 051) + current Next.js UI/UX technical audit + Markdown editor GOAP and ADR review
**Method**: GOAP (Goal-Oriented Action Planning) with ADRs

## Quick Reference — Active Plans

| Priority | Plan | Description | Effort | Status | Issues |
|----------|------|-------------|--------|--------|--------|
| **P0** | [053-goap-markdown-editor-ux-2026-07-12.md](053-goap-markdown-editor-ux-2026-07-12.md) | Markdown editor: real formatting, safe local drafts, quiet feedback, responsive modes, accessibility, and verification | 8-14d | ✅ MERGED | #430, #431 |
| **P1** | [ui-ux-audit-2026-07-11.md](ui-ux-audit-2026-07-11.md) | Current Next.js UI/UX audit: WCAG, responsiveness, interaction trust, rendering performance, and anti-pattern review | 20-30h remediation | ✅ MERGED | #431, #432 |
| **P0** | [054-plan-053-editor-ux-implementation.md](054-plan-053-editor-ux-implementation.md) | Plan 053 editor UX implementation summary — split mode, dirty comparison, type selector, a11y, drafts | 1-2d | ✅ MERGED | #430 |
| **P1** | [055-goap-remaining-053-uiux-tasks-2026-07-14.md](055-goap-remaining-053-uiux-tasks-2026-07-14.md) | Remaining plan 053 + UI/UX audit: reduced motion gating, keyboard a11y, inert control removal, graph index | 2-3d | ✅ MERGED | #431 |
| **P2** | [056-store-selectors-and-typography-2026-07-14.md](056-store-selectors-and-typography-2026-07-14.md) | Store subscription narrowing + typography scale tokens | 1d | ✅ MERGED | #432 |
| **P0** | [048-nextjs-cleanup-and-deprecation-audit-2026-07-09.md](048-nextjs-cleanup-and-deprecation-audit-2026-07-09.md) | Next.js migration cleanup: remove dead deps, fix configs, add tests, align docs | 8-12h | ✅ MERGED | #399 |
| **P0** | [049-goap-nextjs-feature-implementation-2026-07-09.md](049-goap-nextjs-feature-implementation-2026-07-09.md) | AI provider integration, encrypted export, zod schemas, BM25 retrieval, markdown rendering | 40-60h | ✅ MERGED | #399 |
| **P0** | [051-vercel-deployment-fix-2026-07-09.md](051-vercel-deployment-fix-2026-07-09.md) | Fix Vercel deployment failure, add Node 20+ requirement, document prevention | 1-2h | ✅ MERGED | #400 |
| **P0** | [33-post-swarm-critical-features.md](33-post-swarm-critical-features.md) | Library view, search nav, backlinks, CLI unification, Chat→LLM, toolbar, undo/redo | 20-28h | ✅ MERGED | #223–#231, #292, #293, #305, #307 |
| **P1** | [34-architecture-hygiene.md](34-architecture-hygiene.md) | Split 4 oversized files (repository, GraphView, AIHarness, search) | 16-20h | ✅ MERGED | #226 |
| **P1** | [35-test-coverage-expansion.md](35-test-coverage-expansion.md) | Mind map, CLI, graph, extension, E2E tests | 20-28h | ✅ MERGED | #228, #229 |
| **P1** | [36-documentation-overhaul.md](36-documentation-overhaul.md) | CLI docs, JSDoc, DB schema, search arch, onboarding, LLM setup, deployment | 12-16h | ✅ MERGED | #237 |
| **P1** | [37-security-quality-hardening.md](37-security-quality-hardening.md) | API key encryption, SSRF fix, migration fix, snapshot validation | 8-12h | ✅ MERGED | #238–#240 |
| **P0** | [033-goap-open-issues-prs-2026-06-11.md](033-goap-open-issues-prs-2026-06-11.md) | Close 6 open issues + wire missing plan features | 8-12h | ✅ MERGED | #305 |
| **P1** | [040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md](040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md) | Complete export pipeline (PDF, JSON schema v1.0, MD round-trip) + resolve red PRs | 12-18h | ✅ MERGED | #289 |
| **P0** | [041-goap-ui-ux-modernization-and-feature-gaps-2026-06-18.md](041-goap-ui-ux-modernization-and-feature-gaps-2026-06-18.md) | UI modernization (semantic tokens, primitives), full responsiveness (dynamic viewport, 44px targets, mobile viz controls, overlay a11y), feature-gap closure (import persistence, tags, version history, notes search, chat unification) | 90-130h | ✅ MERGED | #232–#236, #227, #231 |
| **P0** | [042-goap-master-implementation-2026-06-22.md](042-goap-master-implementation-2026-06-22.md) | Master GOAP orchestration — 4-wave swarm execution of all open plans (34, 35, 36, 37, 041) | 140-200h | ✅ MERGED | All |
| **P0** | [041-ai-harness-implementation.md](041-ai-harness-implementation.md) | AI Harness integration: enhanced system prompt, structured context, entity-aware tools, UI polish | 6-8h | ✅ COMPLETED | — |

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

## GOAP Execution Order — Master Wave (2026-06-22)

**Plan 042** — Master GOAP orchestration with 4-wave swarm execution. All tracks completed in single coordinated run.

```
Wave 1 (P0 — FOUNDATION — PARALLEL) ──→ ✅ MERGED
  ├─ Tokens (A1-A2): fix undefined tokens, add semantic families
  ├─ Security (A5-A9): API key encryption, SSRF, migration fix, snapshot validation, silent catches
  ├─ Architecture (A10-A13): split repository.ts, GraphView, AIHarness, search.ts
  ├─ Overlay (A4): build <Overlay> primitive (focus-trap, Escape, scroll-lock)
  └─ Motion (A3): prefers-reduced-motion policy
      ↓
Wave 2 (P0/P1 — RESPONSIVE + MODERNIZE — PARALLEL) ──→ ✅ MERGED
  ├─ Layout (B1-B3, B9): fix mobile search, dynamic viewport, library cards
  ├─ Touch (B4, B8): 44px targets, mobile graph/mindmap controls
  ├─ Viz (B6-B7): responsive canvas, graph reads theme tokens
  ├─ Primitives (B10-B11): Button/IconButton/EmptyState/Skeleton, replace hex colors
  └─ A11y (B5): migrate CommandPalette/Settings/EntityReview to <Overlay>
      ↓
Wave 3 (P1/P2 — FEATURES — PARALLEL) ──→ ✅ MERGED
  ├─ Import (C1-C2): CLI import persistence + browser import UI
  ├─ Tags (C3-C4): tags schema, repository, validation, editor/library/search UI
  ├─ History (C5): entity_versions table, capture-on-write, history/diff/restore
  ├─ Search (C6-C8): index notes, semantic toggle, graph filters + node search
  └─ Chat (C9-C10): wire F5/F6/F7, unify chat, wire rate limiter
      ↓
Wave 4 (P1/P2 — QUALITY — PARALLEL) ──→ ✅ MERGED
  ├─ Tests (D1-D6): mind map, CLI, graph, editor extensions, quick wins, E2E
  ├─ Docs (D7-D14): CLI, DATABASE, SEARCH, DEVELOPMENT, LLM-SETUP, DEPLOYMENT, REPOSITORY-API
  ├─ VERSION sync (D15): propagate 0.2.5
  └─ Coverage thresholds (D16): raise to 40-50%
```

### Wave Artifacts

| Wave | Plan | Status |
|------|------|--------|
| 1 | [042-goap-master-implementation-2026-06-22.md](042-goap-master-implementation-2026-06-22.md) | ✅ MERGED |
| 3 | [043-goap-chat-unification-2026-06-22.md](043-goap-chat-unification-2026-06-22.md) | ✅ MERGED |
| 3 | [043-wave3-search-improvements.md](043-wave3-search-improvements.md) | ✅ MERGED |
| 3 | [043-wave3-tags-implementation-2026-06-22.md](043-wave3-tags-implementation-2026-06-22.md) | ✅ MERGED |
| 3 | [044-wave3-import-persistence-2026-06-22.md](044-wave3-import-persistence-2026-06-22.md) | ✅ MERGED |
| 4 | [045-wave4-test-coverage-d5-d6-d16.md](045-wave4-test-coverage-d5-d6-d16.md) | ✅ MERGED |
| 4 | [046-wave4-test-coverage-d1-d2.md](046-wave4-test-coverage-d1-d2.md) | ✅ MERGED |
| 3 | [ADRs/017-chat-unification.md](ADRs/017-chat-unification.md) | ✅ MERGED |

## Legacy Plans (Archived/Completed)

| Plan | Description | Status |
|------|-------------|--------|
| [01-critical-fixes.md](01-critical-fixes.md) | P0 fixes (any type, version, doc references) | ✅ COMPLETED |
| [02-code-quality-v1-completed.md](02-code-quality-v1-completed.md) | Original code quality plan | 📦 SUPERSEDED by 16 |
| [03-core-implementation.md](03-core-implementation.md) | CLI architecture, export, test coverage | ✅ COMPLETED (853 tests) |
| [04-feature-roadmap.md](04-feature-roadmap.md) | AI Harness, claim provenance, semantic search | ✅ COMPLETED |
| [05-documentation-overhaul.md](05-documentation-overhaul.md) | README, JSDoc, PHASES.md | ✅ COMPLETED |
| [ADRs/06-llm-provider-system.md](ADRs/06-llm-provider-system.md) | OpenRouter + Kilo plugin system | ✅ COMPLETED |
| [07-github-template-alignment.md](07-github-template-alignment.md) | Architecture validation | ✅ COMPLETED |
| [08-perplexity-removal.md](08-perplexity-removal.md) | Perplexity deletion | ✅ COMPLETED |
| [09-ui-style-alignment.md](09-ui-style-alignment.md) | Multi-mode atmospheric UI | ✅ COMPLETED |
| [10-implementation-audit-v1-completed.md](10-implementation-audit-v1-completed.md) | Original implementation audit | 📦 SUPERSEDED by 13-20 |
| [11-expansion-roadmap.md](11-expansion-roadmap.md) | P2P sync, synthesis, voice, E2EE, TRIZ, query builder | ✅ COMPLETED |
| [12-doc-resolver-integration.md](12-doc-resolver-integration.md) | Web doc resolver for RAG | ✅ COMPLETED |
| [12-doc-resolver-implementation-roadmap.md](12-doc-resolver-implementation-roadmap.md) | Doc resolver implementation details | ✅ COMPLETED |

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
| 010 | Export Schema v1.0 | ✅ Implemented | KnowledgeStudioExport interface + Zod validators |
| 011 | CLI Command Extraction | ✅ Implemented | cli/commands/ split |
| 012 | PDF Export via @react-pdf/renderer | ✅ Implemented | Single/multi-note PDF, dynamic import |
| 013 | Semantic Design Tokens & Theme Coverage | 📝 Proposed | Fix undefined tokens, status/entity/graph token families, reduced-motion → plan 041 |
| 014 | Overlay/Modal Accessibility Primitive | 📝 Proposed | Shared `<Overlay>` (focus-trap, Escape, scroll-lock, dialog roles) → plan 041 |
| 015 | Responsive & Visualization Theming | 📝 Proposed | Dynamic viewport, 44px targets, viz CSS-token bridge, mobile controls → plan 041 |
| 016 | Feature-Gap Closure | 📝 Proposed | Import persistence, tags, version history, notes search, chat unification → plan 041 |
| 017 | Chat Unification Strategy | ✅ Accepted | Shared chat flow and provider integration baseline |
| 018 | Next.js Architecture Baseline | 📝 Proposed | Local-first Zustand + localStorage; no required backend |
| 019 | AI Harness Provider Integration | 📝 Proposed | Client-side BYO-key provider contract |
| 020 | Markdown Content and Editor Engine | ✅ Accepted | Markdown-source editing, textarea proof gate, CodeMirror fallback → plan 053 |
| 021 | Real Encrypted Export | 📝 Proposed | WebCrypto AES-GCM export strategy |
| 022 | Client-Side Retrieval Engine | 📝 Proposed | Shared in-browser retrieval for Chat and Search |
| 023 | Editor Draft Persistence and Commit Lifecycle | 📝 Proposed | Versioned recovery drafts, acknowledged writes, in-place commits, and conflicts → plan 053 |
| 024 | Editor Feedback and Notification Policy | 📝 Proposed | Inline routine feedback; exceptional and cross-context toasts only → plan 053 |

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
