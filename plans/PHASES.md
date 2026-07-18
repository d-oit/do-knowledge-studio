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

## Phase 3: Synthesis (Complete - 2026-05)
- [x] Local RAG (Orama-based search)
- [x] Bi-directional markdown sync (CLI Support)
- [x] Export to static site (Markdown, JSON, HTML)
- [x] Knowledge graph snapshots with diffing
- [x] Node.js CLI with better-sqlite3 adapter

## Phase 4: Security & Quality (Complete - 2026-05)
- [x] XSS fixes in all export paths (PR #200, #216)
- [x] API key isolation from VITE_ env vars (PR #219)
- [x] Bug fixes: broken nav, dead code, version sync (PR #200)
- [x] CI timeouts, caching, tsconfig cleanup (PR #217)
- [x] Test coverage expanded to 671 tests (PR #221, #354)
- [x] Eliminate all `as any` and unsafe casts (PR #209)
- [x] Consistent error handling with AppError
- [x] N+1 query elimination (PR #220)

## Phase 5: Feature Completion (Complete - 2026-06)
- [x] Entity editing and deletion in UI
- [x] Mind map node editing
- [x] Force-directed, circular, and hierarchical graph layouts
- [x] Keyboard-accessible graph navigation
- [x] Responsive design (mobile, tablet, desktop)
- [x] Undo/redo across editor, graph, and mind map
- [x] Library/browser view with virtualization
- [x] Backlinks and bidirectional linking
- [x] Tags and categories system
- [x] Entity version history
- [x] Import persistence (CLI + browser)

## Phase 6: Intelligence (Complete - 2026-06)
- [x] Streaming AI chat with LLM provider integration (OpenRouter, Kilo, Anthropic, Ollama)
- [x] Semantic search with embeddings (all-MiniLM-L6-v2)
- [x] Entity auto-hydration from external sources (Jina AI reader)
- [x] Claim provenance and verification tracking
- [x] Entity-aware AI tools (list, query, link)
- [x] Agentic tool-calling loop (search, create, link)
- [x] Chat history persistence (IndexedDB)
- [x] Rate limiting and API key encryption
- [ ] Advanced TRIZ analysis features

## Phase 7: Export Enhancement (Complete - 2026-06)
- [x] Shared export core (browser + CLI) (PR #220)
- [x] Graph PNG export
- [x] PDF export (single/multi-note)
- [x] JSON schema v1.0 export
- [x] Markdown round-trip import/export

## Phase 8: Collaboration (Complete - 2026-07-17)
- [x] ADR 026: P2P sync architecture (Yjs + WebRTC + QR pairing)
- [x] Sync engine core (yjs, y-webrtc, y-indexeddb)
- [x] Device pairing — QR code flow
- [x] CRDT merge — conflict-free entity resolution
- [x] Sync UI — status, history, controls
- [x] Network discovery — BroadcastChannel
- [x] Conflict UI — manual merge
- [x] Multi-user presence — awareness protocol
- [x] Live cursors and selection indicators
- [x] Voice-to-knowledge — speech-to-text
- [x] Voice NLP — intent parsing

## Phase 9: Performance, PWA & Polish (Complete - 2026-07-17)
- [x] Bundle analysis and tree-shaking audit
- [x] Lazy-load heavy components (graph, mindmap, AI)
- [x] Dynamic imports for sync module
- [x] Service worker with cache-first strategy
- [x] Offline indicator and sync queue
- [x] PWA manifest and installability
- [x] Keyboard navigation audit and fixes
- [x] Screen reader announcements for sync events
- [x] Color contrast and focus indicators
- [x] Loading states and skeleton screens
- [x] Error boundaries per view
- [x] Keyboard shortcuts help dialog
