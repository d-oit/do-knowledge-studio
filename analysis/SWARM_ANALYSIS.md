# Swarm Analysis Report

**Project:** do-knowledge-studio  
**Date:** 2026-05-31  
**Method:** 6-agent parallel swarm analysis (Feature, Implementation, Documentation, Tests, Architecture, Security/Quality)

---

## Executive Summary

| Perspective | Critical | High | Medium | Low |
|-------------|----------|------|--------|-----|
| Feature Gaps | 4 | 13 | 12 | 6 |
| Implementation | 0 | 3 | 12 | 3 |
| Documentation | 0 | 9 | 16 | 3 |
| Test Coverage | 2 | 8 | 5 | 3 |
| Architecture | 0 | 6 | 10 | 2 |
| Security & Quality | 0 | 1 | 7 | 5 |
| **TOTAL** | **6** | **40** | **62** | **22** |

**Codebase Health:** Clean v0.1.0 — zero TODO debt, proper Zod validation, no `any` types, excellent lazy loading. Main risks are architectural scaling (4 files exceed 500 LOC), incomplete feature wiring (search→editor, chat→LLM), and thin test coverage.

---

## 1. Feature Gaps

### Critical (4)

| ID | Gap | Impact | File |
|----|-----|--------|------|
| FG-C1 | **No Library/Entity Browser** — Library nav routes to editor, no list view | Cannot browse knowledge base | `SidebarNav.tsx`, `App.tsx:174` |
| FG-C2 | **Search results don't navigate to entities** — `handleSearchResultClick` switches view without loading entity | Search is useless for navigation | `App.tsx:98` |
| FG-C3 | **CLI uses separate database** (`.studio-cli.db`) — CLI and browser app are disconnected | CLI automation defeats purpose | `cli/db.ts:8` |
| FG-C4 | **No backlinks/bidirectional linking** — Mentions create one-way links only | Core knowledge management feature missing | `src/db/repository.ts` |

### High (13)

| ID | Gap | Impact | File |
|----|-----|--------|------|
| FG-H1 | Minimal toolbar — no italic, lists, code, links | Rich text editor is not rich | `Editor.tsx:248-281` |
| FG-H2 | No directed edge rendering in graph | Graph misrepresents relationships | `GraphView.tsx` |
| FG-H3 | No graph filtering by entity/relation type | Large graphs unusable | `GraphControls.tsx` |
| FG-H4 | No graph search/highlight | Cannot find nodes in graph | `GraphView.tsx` |
| FG-H5 | No edge labels on medium/large graphs | Relationships invisible | `GraphView.tsx:106` |
| FG-H6 | Mind map entity creation creates orphaned nodes | Data inconsistency | `MindMapView.tsx:148-180` |
| FG-H7 | Static export is single HTML file placeholder | Export feature incomplete | `export-core.ts` |
| FG-H8 | No import functionality (markdown, JSON, OPML) | Cannot migrate from other tools | — |
| FG-H9 | CLI missing CRUD commands for claims, notes, snapshots | CLI automation incomplete | `cli/index.ts` |
| FG-H10 | Chat is search-only, not LLM-powered | Confusing UX split | `Chat.tsx:38-57` |
| FG-H11 | No tags/categories system | Insufficient categorization | — |
| FG-H12 | No version history / undo-redo | No accident recovery | — |
| FG-H13 | No undo/redo in editor or graph | Basic UX missing | `Editor.tsx` |

### Medium (12)

| ID | Gap | Impact |
|----|-----|--------|
| FG-M1 | No Markdown keyboard shortcuts discoverability | Hidden features |
| FG-M2 | Mind map not integrated with graph structure | Inconsistent views |
| FG-M3 | No mind map export (Markdown/JSON/OPML) | Cannot share mind maps |
| FG-M4 | CLI search doesn't search claims | Inconsistent search |
| FG-M5 | No Orama index persistence to OPFS | Slow startup |
| FG-M6 | Export missing mind map data | Incomplete export |
| FG-M7 | Only 2 LLM providers (OpenRouter, Kilo) | Limited AI options |
| FG-M8 | No AI-powered graph insights | Missing intelligence |
| FG-M9 | No conversation persistence | Lost AI context |
| FG-M10 | No file/attachment support | No binary assets |
| FG-M11 | No data encryption at rest | Data protection gap |
| FG-M12 | No templates system | Productivity gap |

### Low (6)

| ID | Gap | Impact |
|----|-----|--------|
| FG-L1 | No graph SVG/JSON export | Limited sharing |
| FG-L2 | No CLI watch mode | Manual sync |
| FG-L3 | No view-switching keyboard shortcuts | Power user friction |
| FG-L4 | No drag-and-drop between views | No direct manipulation |
| FG-L5 | No dark mode persistence | Minor UX annoyance |
| FG-L6 | No inline entity preview on mention hover | Minor convenience |

---

## 2. Implementation Completeness

| ID | Issue | Priority | File:Line |
|----|-------|----------|-----------|
| IM-1 | **Browser migration fallback only loads `001_initial.sql`** — subsequent migrations silently skipped | **High** | `migrate.ts:110-116` |
| IM-2 | **Snapshot JSON parse without validation** — `as` cast with no runtime check on deserialized graph data | **High** | `GraphControls.tsx:106-107` |
| IM-3 | **API keys stored in plaintext localStorage** | **High** | `llm/config.ts:30,41` |
| IM-4 | PDF export uses magic `setTimeout(500)` instead of load handler | Medium | `ExportPanel.tsx:87` |
| IM-5 | Semantic search weights hardcoded (0.5/0.5) | Medium | `search.ts:509-510` |
| IM-6 | Entity type dropdown is closed/hardcoded (4 types only) | Medium | `Editor.tsx:16-21` |
| IM-7 | Search result click doesn't open specific entity | Medium | `App.tsx:97-103` |
| IM-8 | Mind map node ID uses `Math.random()` fallback | Medium | `MindMapView.tsx:38` |
| IM-9 | No URL validation on source URL input | Medium | `Editor.tsx:119-125` |
| IM-10 | Worker timeout leaves orphaned promises | Medium | `connection-pool.ts:180-196` |
| IM-11 | FTS5 incremental update not transactional | Medium | `search.ts:252-263` |
| IM-12 | No rate limiting on external URL fetches | Medium | `search.ts:330-378` |
| IM-13 | Logger has no persistence or structured output | Medium | `logger.ts:1-16` |
| IM-14 | Connection pool close races with in-flight requests | Low | `connection-pool.ts:121-138` |
| IM-15 | Migration checksum uses weak 32-bit hash | Low | `migrate.ts:18-26` |
| IM-16 | Logger bypasses centralized logging in worker | Low | `db-worker.ts:47,48,63,66,143` |

---

## 3. Documentation Gaps

### High (9)

| ID | Gap | Why It Matters |
|----|-----|----------------|
| DOC-H1 | **CLI commands not documented** — 17+ commands with no reference | Users can't use CLI without reading source |
| DOC-H2 | **No JSDoc on `.tsx` files** — 600-line AIHarness has zero JSDoc | Components hard to maintain |
| DOC-H3 | **No database schema docs** — 6 tables, no ER diagram or reference | Can't develop against schema |
| DOC-H4 | **No search architecture docs** — dual FTS5+Orama system undocumented | Search quality is core UX |
| DOC-H5 | **No developer onboarding guide** — steep learning curve | New contributors blocked |
| DOC-H6 | **LLM provider configuration undocumented** — AI chat is key feature | Users can't set up AI |
| DOC-H7 | **No deployment guide** — OPFS requires HTTPS, no hosting docs | Users can't self-host |
| DOC-H8 | **Repository API undocumented** — 20+ public methods, inconsistent JSDoc | Primary data layer unclear |
| DOC-H9 | **VERSION file / CHANGELOG sync broken** — badge says 0.1.0, CHANGELOG says 0.2.3 | Confuses users |

### Medium (16)

| ID | Gap |
|----|-----|
| DOC-M1 | No README screenshots/GIF |
| DOC-M2 | No "How Local-First Works" explanation |
| DOC-M3 | No usage/interaction guide |
| DOC-M4 | Zod schemas lack JSDoc |
| DOC-M5 | Error codes lack context docs |
| DOC-M6 | LLM types interfaces undocumented |
| DOC-M7 | NLP functions undocumented |
| DOC-M8 | No ADRs for key decisions |
| DOC-M9 | Env vars not fully documented |
| DOC-M10 | No entity-relationship diagram |
| DOC-M11 | No data model documentation |
| DOC-M12 | No test strategy documentation |
| DOC-M13 | No security audit documentation |
| DOC-M14 | Job coordinator API undocumented |
| DOC-M15 | No accessibility compliance docs |
| DOC-M16 | No performance documentation |

### Low (3)

| ID | Gap |
|----|-----|
| DOC-L1 | No TypeScript config guide |
| DOC-L2 | No release process docs |
| DOC-L3 | SECURITY.md may be duplicated |

---

## 4. Test Coverage

| ID | Gap | Priority | Coverage |
|----|-----|----------|----------|
| TC-1 | **Mind Map — zero unit tests** (415 LOC, `buildTree()` untested) | **Critical** | 0% |
| TC-2 | **CLI — zero automated tests** (18 commands, 560 LOC) | **Critical** | 0% |
| TC-3 | Graph View/Inspector — zero unit tests | **High** | 0% |
| TC-4 | Editor Extensions (Claim, Mention) — zero unit tests | **High** | 0% |
| TC-5 | useFocusTrap hook — zero unit tests (accessibility risk) | **High** | 0% |
| TC-6 | Markdown renderer (LLM) — zero unit tests (XSS risk) | **High** | 0% |
| TC-7 | E2E tests — smoke-level only, no workflow tests | **High** | Smoke |
| TC-8 | Error handling coverage gaps — repository, search, resolver | **High** | Partial |
| TC-9 | DbProvider/useDb — zero unit tests | Medium | 0% |
| TC-10 | App.tsx shell — zero unit tests | Medium | 0% |
| TC-11 | 6 UI components — zero unit tests | Medium | 0% |
| TC-12 | Performance module — zero tests | Low-Med | 0% |
| TC-13 | Logger, Constants — zero tests | Low | 0% |
| TC-14 | LLM barrel exports — zero tests | Low | 0% |

**Current thresholds:** branches: 14%, functions: 16%, lines: 25%, statements: 24% — extremely low.

---

## 5. Architecture & Patterns

### High (6)

| ID | Issue | Why It Matters |
|----|-------|----------------|
| AR-H1 | **4 files exceed 500 LOC** — `repository.ts` (957), `GraphView.tsx` (793), `AIHarness.tsx` (600), `search.ts` (555) | Violates explicit hard rule |
| AR-H2 | **Singleton repository with no DI** — global instance, can't mock | Untestable, tightly coupled |
| AR-H3 | **Side-effect job handler registration** — `search.ts` registers on import | Fragile initialization order |
| AR-H4 | **No event bus for cross-feature mutations** — editor doesn't notify graph | Data consistency risk |
| AR-H5 | **App.tsx God Component** — 11 useState hooks, manages all state | Scalability bottleneck |
| AR-H6 | **Business logic in React components** — Editor `handleSave` has 100+ lines of DB operations | Violates separation of concerns |

### Medium (10)

| ID | Issue |
|----|-------|
| AR-M1 | Features import `repository` singleton directly (bypasses context) |
| AR-M2 | Missing `IRepository` interface (inconsistent abstraction) |
| AR-M3 | Full data refresh on every navigation (no caching) |
| AR-M4 | Orama index rebuild on every app start (slow for large datasets) |
| AR-M5 | Inconsistent feature module granularity |
| AR-M6 | Error swallowing in search services (masks real issues) |
| AR-M7 | No user-facing error states in search UI |
| AR-M8 | GraphView contains layout algorithms (not reusable outside React) |
| AR-M9 | Ad-hoc data refresh strategy (no incremental updates) |
| AR-M10 | Migration errors are non-blocking (data integrity risk) |

### Low (2)

| ID | Issue |
|----|-------|
| AR-L1 | `Array.find()` in render without memoization |
| AR-L2 | Inconsistent error handling patterns |

### Architecture Strengths

1. Excellent lazy loading with preload-on-hover
2. Clean SQLite WASM/Node.js abstraction
3. Worker pool with timeout + auto-recovery
4. Progressive search (exact → semantic → related)
5. Built-in performance profiling
6. Zod validation at repository boundary
7. Job coalescing preventing redundant work
8. Consistent ErrorBoundary usage
9. Virtual scrolling in long-list views
10. Clean LLM provider interface (strategy pattern)

---

## 6. Security & Quality

### Security (0 Critical, 1 High, 3 Medium, 2 Low)

| ID | Issue | Priority | File |
|----|-------|----------|------|
| S-01 | **API keys in plaintext localStorage** | High | `llm/config.ts:30-41` |
| S-02 | SSRF in URL resolution — no private IP blocking | Medium | `resolver.ts:70-132` |
| S-03 | Client-side rate limiting easily bypassed | Medium | `AIHarness.tsx:30-31` |
| S-04 | No URL scheme validation in resolver | Medium | `resolver.ts:143-148` |
| S-05 | DOMPurify allows `target` attribute (reverse tabnapping) | Low | `security.ts:3-8` |
| S-06 | Silent error swallowing in LLM providers | Low | `openrouter.ts:103`, `kilo.ts:103` |

### Quality (0 Critical, 0 High, 4 Medium, 3 Low)

| ID | Issue | Priority |
|----|-------|----------|
| Q-01 | `repository.ts` exceeds 500 LOC (957 lines) | Medium |
| Q-02 | `AIHarness.tsx` exceeds 500 LOC (600 lines) | Medium |
| Q-03 | 14 silent catch blocks (no logging) | Medium |
| Q-04 | Hardcoded magic numbers in multiple files | Low |
| Q-05 | Unsafe type assertions in migration code | Low |
| Q-06 | Duplicate `escapeHtml` function | Low |
| Q-07 | `maskApiKey` function has redundant logic | Low |

### Positive Security Findings

- SQL injection prevention via parameterized queries
- Zod validation on all database operations
- CSP headers in exported HTML
- DOMPurify sanitization on all HTML output
- No `any` types in codebase

---

## 7. Cross-Cutting Concerns (Confirmed by Multiple Perspectives)

| Issue | Perspectives | Summary |
|-------|-------------|---------|
| **Search result → editor navigation broken** | Feature (FG-C2) + Implementation (IM-7) + Architecture (AR-H4) | `handleSearchResultClick` doesn't load entity; search is read-only |
| **CLI disconnected from browser** | Feature (FG-C3) + Implementation | Separate databases make CLI automation useless |
| **No undo/redo anywhere** | Feature (FG-H12, FG-H13) + Architecture | TipTap history not configured; no graph undo |
| **API keys in plaintext** | Implementation (IM-3) + Security (S-01) | localStorage stores unencrypted API keys |
| **Repository singleton is untestable** | Architecture (AR-H2, AR-M2) + Tests (TC-8) | No DI, no interface, can't mock for tests |
| **4 files exceed 500 LOC** | Architecture (AR-H1) + Quality (Q-01, Q-02) | repository.ts, GraphView.tsx, AIHarness.tsx, search.ts |
| **Chat disconnected from LLM** | Feature (FG-H10) + Implementation (IM-9) | Chat.tsx never calls LLM providers despite infrastructure existing |
| **Mind map has zero tests** | Tests (TC-1) + Feature (FG-H6) | 415 LOC completely untested; buildTree() is pure and testable |
| **CLI has zero tests** | Tests (TC-2) + Feature (FG-H9) | 18 commands, 560 LOC, no tests; `db:reset` is catastrophic risk |
| **Silent error swallowing** | Implementation (IM-14, IM-16) + Quality (Q-03) | 14+ silent catch blocks mask real issues |
| **Side-effect initialization** | Architecture (AR-H3) | search.ts registers job handlers on import; fragile |
| **No backlinks** | Feature (FG-C4) | Core knowledge management feature missing |
| **Missing data validation on load** | Implementation (IM-2) | Snapshot JSON parsed without Zod validation |
| **Browser migration only loads first file** | Implementation (IM-1) | Subsequent migrations silently skipped |

---

## 8. Quick Wins (< 1 day each)

| # | Win | Effort | Impact |
|---|-----|--------|--------|
| 1 | **Wire search result click to entity** — pass `result.id` to editor in `handleSearchResultClick` | 30 min | Critical feature unblocked |
| 2 | **Wire Chat to LLM** — `Chat.tsx` already has search results; pipe to `openrouter.chat()` | 2 hours | Core AI feature works |
| 3 | **Add Zod validation for snapshot load** — wrap `JSON.parse(snap.nodes_json)` in safeParse | 1 hour | Prevents crash from corrupt data |
| 4 | **Fix browser migration loading** — use `import.meta.glob` to bundle all migration files | 1 hour | Prevents schema drift |
| 5 | **Add `useFocusTrap` unit tests** — 5 tests, pure logic | 30 min | Accessibility coverage |
| 6 | **Add Markdown renderer unit tests** — 10 tests, pure function | 1 hour | XSS prevention verified |
| 7 | **Add URL validation in resolver** — block `javascript:`, `file://`, private IPs | 1 hour | SSRF prevention |
| 8 | **Fix `maskApiKey` redundant logic** — simplify function | 5 min | Code quality |
| 9 | **Fix VERSION/CHANGELOG sync** — update VERSION to 0.2.3 | 5 min | Documentation accuracy |
| 10 | **Extract shared test builders** — `createMockEntity`, `createMockClaim` to `src/test/builders.ts` | 2 hours | Test infrastructure |

---

## 9. Dependencies Between Gaps

```
FG-C1 (Library View) ──depends on──> FG-C2 (Search → Editor navigation)
                                       │
AR-H2 (Singleton Repository) ──blocks──> TC-8 (Error handling tests)
                                       │
AR-H1 (500 LOC violations) ──blocks──> TC-1 (Mind map tests)
                                      > TC-3 (Graph tests)
                                      > TC-4 (Editor extension tests)
                                       │
FG-C3 (CLI separate DB) ──blocks──> TC-2 (CLI tests)
                                  > FG-H9 (CLI missing commands)
                                       │
FG-H10 (Chat no LLM) ──blocked-by──> IM-3 (API keys in plaintext)
                                      │
AR-H4 (No event bus) ──causes──> FG-C4 (No backlinks)
                                 > FG-H6 (Mind map orphaned nodes)
                                 > IM-11 (FTS not transactional)
                                       │
AR-H5 (App.tsx God Component) ──causes──> AR-M3 (Full refresh on nav)
                                          AR-M9 (Ad-hoc data refresh)
```

---

## 10. Prioritized Action Plan

### Phase 1: Critical Quick Wins (1-2 days)
1. Wire search result click → editor (FG-C2)
2. Fix browser migration fallback (IM-1)
3. Add Zod validation for snapshot load (IM-2)
4. Add URL validation in resolver (S-02)
5. Fix VERSION sync (DOC-H9)

### Phase 2: Core Feature Completion (1 week)
6. Build Library/Entity Browser view (FG-C1)
7. Wire Chat to LLM providers (FG-H10)
8. Add backlinks/bidirectional linking (FG-C4)
9. Expand toolbar (italic, lists, code, links) (FG-H1)
10. Add undo/redo (FG-H12, FG-H13)

### Phase 3: Architecture Hygiene (1 week)
11. Split `repository.ts` into submodules (AR-H1)
12. Split `GraphView.tsx` (AR-H1)
13. Split `AIHarness.tsx` (AR-H1)
14. Split `search.ts` (AR-H1)
15. Define `IRepository` interface (AR-M2)
16. Move job handler registration to explicit init (AR-H3)

### Phase 4: Test Coverage (2 weeks)
17. Extract `buildTree()` and add mind map tests (TC-1)
18. Add CLI command tests (TC-2)
19. Add graph data transformation tests (TC-3)
20. Add editor extension tests (TC-4)
21. Add error handling tests across repository, search, resolver (TC-8)
22. Expand E2E to cover CRUD lifecycle workflows (TC-7)

### Phase 5: Documentation (1 week)
23. Create `docs/CLI.md` (DOC-H1)
24. Create `docs/DATABASE.md` with ER diagram (DOC-H3)
25. Create `docs/DEVELOPMENT.md` onboarding guide (DOC-H5)
26. Create `docs/LLM-SETUP.md` (DOC-H6)
27. Create `docs/SEARCH.md` (DOC-H4)
28. Add JSDoc to all exported components (DOC-H2)

### Phase 6: Polish & Hardening (ongoing)
29. Encrypt API keys at rest (S-01)
30. Add tags/categories system (FG-H11)
31. Add graph filtering/search (FG-H3, FG-H4)
32. Improve static export to multi-page site (FG-H7)
33. Add import functionality (FG-H8)
34. Raise test coverage thresholds to 40-60%

---

## Appendix: Codebase Strengths Preserved

These patterns should be maintained and extended:

- **Zero TODO debt** — exceptional for v0.1.0
- **Zod validation** at all data boundaries
- **Progressive search** with staged fallback (exact → semantic → related)
- **Worker pool** with timeout and auto-recovery
- **Job coalescing** preventing redundant work
- **Lazy loading** with preload-on-hover
- **Error boundaries** on every lazy feature
- **Virtual scrolling** in long lists
- **DOMPurify** on all HTML output
- **No `any` types** — strict TypeScript
