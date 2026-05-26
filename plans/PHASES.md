# PHASES

## Phase 1: Foundation (Complete)
- [x] SQLite WASM + OPFS Client
- [x] Entity/Claim/Link Repository
- [x] Basic UI with View Switching
- [x] CLI Harness

## Phase 2: Integration (Complete)
- [x] Tiptap claims extension (convert text to claims)
- [x] Local search indexing (FTS5 + Orama)
- [x] Graph neighborhood rendering (Focus Mode)

## Phase 3: Synthesis (In Progress)
- [x] Local RAG (Orama-based search)
- [x] Bi-directional markdown sync (CLI Support)
- [x] Export to static site (Simulated)
- [ ] Real export implementation
- [ ] AI Harness integration

## Phase 4: Security & Stability (In Progress — 2026-05)
- [ ] Security: XSS fixes in all export paths
- [ ] Security: API key isolation from VITE_ env vars
- [ ] Bugs: Broken sidebar nav, dead code, version sync
- [ ] Infra: CI timeouts, caching, tsconfig cleanup
- See [Plan 13](13-security-fixes.md), [Plan 14](14-bugfix-frontend.md), [Plan 15](15-config-fixes.md)

## Phase 5: Quality & Performance (Planned — 2026-06)
- [ ] Test coverage ≥50% (milestone toward 80%)
- [ ] Eliminate all `as any` and unsafe casts
- [ ] Consistent error handling with AppError
- [ ] Per-feature ErrorBoundaries
- [ ] N+1 query elimination, LRU cache, debounce
- [ ] Lazy loading of heavy dependencies
- See [Plan 16](16-code-quality-v2.md), [Plan 17](17-performance-optimizations.md), [Plan 19](19-db-migration-framework.md)

## Phase 6: Feature Completion (Planned — 2026-06/07)
- [ ] Entity editing and deletion in UI
- [ ] Mind map node editing
- [ ] Force-directed and hierarchical graph layouts
- [ ] Keyboard-accessible graph navigation
- [ ] Accessibility compliance (WCAG 2.2 AA)
- See [Plan 18](18-feature-gap-closure.md)

## Phase 7: Export Enhancement (Planned — 2026-07)
- [ ] Graph PNG export
- [ ] PDF and DOCX export formats
- [ ] Shared export core (browser + CLI)
- See [Plan 20](20-export-enhancement.md)

## Phase 8: Intelligence (Future)
- [ ] Semantic search with embeddings
- [ ] Claim provenance tracking
- [ ] Advanced TRIZ analysis features
- [ ] AI Harness full integration
- See [Plan 04](04-feature-roadmap.md), [Plan 11](11-expansion-roadmap.md)

## Phase 9: Collaboration (Future)
- [ ] Local-first P2P sync (WebRTC)
- [ ] Multi-user support
- [ ] Voice-to-knowledge
- See [Plan 11](11-expansion-roadmap.md)
