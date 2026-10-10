# PHASES

> **Note**: Phases 1-3 describe the original Vite/SQLite architecture and are
> historical records. The project migrated to Next.js/Zustand/localStorage
> (ADR 018). Items marked [historical] were completed in the prior architecture
> and may not apply to the current codebase.

## Phase 1: Foundation (Historical — Vite/SQLite era)
- [x] SQLite WASM + OPFS Client [historical — removed in ADR 018]
- [x] Entity/Claim/Link Repository [historical — replaced by Zustand store]
- [x] Basic UI with View Switching
- [x] CLI Harness [historical — removed in Next.js migration]

## Phase 2: Integration (Historical — Vite/SQLite era)
- [x] Tiptap claims extension [historical — replaced with textarea]
- [x] Local search indexing [historical — Orama removed, now BM25]
- [x] Graph neighborhood rendering (Focus Mode)

## Phase 3: Synthesis (Historical — Vite/SQLite era)
- [x] Local RAG [historical — Orama removed, now BM25]
- [x] Bi-directional markdown sync [historical — CLI removed]
- [x] Export to static site (Markdown, JSON, HTML)
- [x] Knowledge graph snapshots [historical — stores view bookmarks, not revisions]
- [x] Node.js CLI [historical — removed in Next.js migration]

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
- [x] Streaming AI chat with LLM provider integration (OpenRouter, Ollama)
- [x] BM25 keyword search with ranked results — **historical label decision**: this line was renamed from "semantic search" in Plan 072 when only BM25 existed. That label decision is now **superseded**: a real semantic mode shipped in `src/lib/search/vector-store.ts` (embedding-backed, with lexical fallback), so "semantic search" describes shipped behavior and BM25 is the lexical fallback.
- [x] Entity auto-hydration from external sources (Jina AI reader)
- [x] Claim provenance and verification tracking
- [x] Entity-aware AI tools (list, query, link)
- [x] Agentic tool-calling loop (search, create, link)
- [x] Chat history persistence [localStorage, not IndexedDB]
- [x] Rate limiting and API key encryption [session-only, per ADR 028]
- [x] Advanced TRIZ analysis features

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

## Phase 10: Documentation & Code Hygiene (Complete - 2026-07-18)
- [x] PHASES.md: check all completed items (TRIZ analysis features)
- [x] GOAP.md: check all success criteria (8 goals × 4-6 criteria)
- [x] INDEX.md: update metrics and session history
- [x] LOC remediation: split triz-data.ts (743→4 files)
- [x] LOC remediation: extract ai-harness-settings.tsx (563→under500)

---

## Current progress (2026-10-05)

Added by [Plan 162](162-roadmap-progress-and-next-work-2026-10-05.md). The dated
phases above are preserved as written. This section records what shipped after
them, each with its successor plan. **No Phase 11 is claimed** — no phase was
defined or completed for this work.

| Capability | Status | Successor plan |
|---|---|---|
| Semantic search (embedding-backed vector store with lexical fallback) | `Implemented — source-confirmed` | Phase 6 label decision superseded; `src/lib/search/vector-store.ts` |
| CPU-first in-browser local AI provider (WASM, WebGPU opt-in) | `Implemented — source-confirmed` | [155](155-cpu-first-local-ai-and-settings-persistence.md), ADR 040 |
| Claim-aware undo (history carries claims; dangling selection cleared) | `Implemented — source-confirmed` | [157](157-codebase-gap-and-feature-remediation.md) W3 |
| Hydration refusal protection and quarantine (fail closed) | `Implemented — source-confirmed` | [159](159-rejected-library-recovery-visibility-and-fail-closed.md), ADR 028 |
| Test-source type gating (`ignoreSourceErrors: false`) | `Implemented — source-confirmed` | [159](159-rejected-library-recovery-visibility-and-fail-closed.md) F7 |
| Six `React.lazy` view boundaries, offline-capable | `Implemented — source-confirmed`; offline coverage is Plan 161's dated 2026-09-30 result | [161](161-offline-lazy-view-precache-and-framework-refresh-2026-09-30.md), ADR 041 |
| Encrypted self-contained HTML reader, `okf` export format | `Implemented — source-confirmed` | Plan 110 / ADR 021 / ADR 031 |

Open work, in priority order — recovery reachability, deletion/export integrity,
sync join/rejoin, heavy-leaf deferral, recorded follow-ons, skills/docs
maintenance, then the ranked new features — is tracked in
[162-roadmap-progress-and-next-work-2026-10-05.md](162-roadmap-progress-and-next-work-2026-10-05.md).
