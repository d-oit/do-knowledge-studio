# Plan 11: Expansion Roadmap & New Features

**Date**: 2026-05-07  
**Status**: Historical expansion roadmap — partially superseded by later plans; reconciled 2026-10-05  
**Historical note**: the SQLite/Orama/CLI designs below describe the 2026-05
architecture and are preserved as records, not as current implementation
instructions. Section statuses were re-checked against source on 2026-10-05; see
[162-roadmap-progress-and-next-work-2026-10-05.md](162-roadmap-progress-and-next-work-2026-10-05.md).
**Goal**: Identify high-value features beyond the core MVP that align with the local-first, AI-augmented knowledge studio vision.

## 11.1 Auto-Synthesis Agent (Local-First Hybrid)
**Concept**: A background agent that periodically analyzes the knowledge base to suggest connections or identify contradictions using local heuristics and external document resolution.
**Status**: ❌ Not implemented in the current architecture — candidate, not scheduled. Checked 2026-10-05: no `SynthesisAgent`, "Synthesis Inbox", or equivalent component/symbol exists under `src/` or `e2e/`. Carried as `Candidate — not scheduled` in [162](162-roadmap-progress-and-next-work-2026-10-05.md).
- **Action**:
    - Implement `SynthesisAgent` in `src/lib/agents/`.
    - **Local Heuristics**: Use Orama vector similarity scores and shared keyword/tag overlap to identify potential links.
    - **TRIZ Contradiction Audit**: Apply `triz-analysis` skill to identify semantic contradictions between claims.
    - **External Verification**: Use `do-web-doc-resolver` (utilizing Tavily, Firecrawl, or Tinyfish backends) to fetch external documentation for a concept pair and verify if they are commonly linked in existing literature (using compact markdown synthesis).
    - Present suggestions to the user in a "Synthesis Inbox" for manual approval (Local-first "human-in-the-loop").

## 11.2 Local-First P2P Sync
**Concept**: Sync between two devices on the same local network without a server.
**Status**: ✅ DONE (2026-06-25) — **historical record**, not newly verified by this reconciliation. The current sync implementation is `src/lib/sync/` (Yjs + WebRTC + `IndexeddbPersistence`); its open gaps are tracked in [162](162-roadmap-progress-and-next-work-2026-10-05.md) #3.
- **Action**:
    - Research `WebRTC` or `Local Area Network` discovery.
    - Implement a "Sync QR Code" to pair devices.
    - Use `sqlite-wasm` delta syncing to merge changes.

## 11.3 Voice-to-Knowledge
**Concept**: Use browser speech-to-text to create entities and claims hands-free.
**Status**: ✅ DONE (2026-06-25) — **historical record**, not newly verified by this reconciliation.
- **Action**:
    - Use `Web Speech API` for live transcription.
    - Implement NLP intent parsing to extract `(Entity, Relation, Target)` from spoken sentences.

## 11.4 Interactive TRIZ Matrix Tool
**Concept**: A dedicated UI for resolving technical contradictions using the TRIZ matrix.
**Status**: ✅ DONE (2026-06-25) — **historical record**, not newly verified by this reconciliation.
- **Action**:
    - Create `src/features/triz/TrizMatrix.tsx`.
    - Allow users to select "Improving Parameter" and "Worsening Parameter".
    - Fetch "Inventive Principles" and provide examples via AI agent.

## 11.5 Encrypted JSON Export with a Self-Contained HTML Reader
**Concept**: Export to a format that can be stored on untrusted cloud drives safely.
**Status**: `Implemented — source-confirmed` (2026-10-05). The implemented path is **JSON** plus a bundled reader document, not encrypted Markdown: `src/components/studio/views/use-export-handlers.ts:282-304` runs `buildJsonExport` → `encryptData` (AES-256-GCM, PBKDF2 key derivation) → `buildEncryptedReaderHtml`, then downloads the reader via `downloadFile` as a Blob. The document is never injected into the DOM.

## 11.6 Visual Query Builder
**Concept**: A node-based UI (like React Flow) to build complex SQLite/Orama queries visually.
**Status**: ❌ Not implemented in the current architecture — candidate, not scheduled. Checked 2026-10-05: no query-builder component or symbol exists under `src/` or `e2e/`. Its SQLite/Orama target no longer exists (ADR 018). Carried as `Candidate — not scheduled` in [162](162-roadmap-progress-and-next-work-2026-10-05.md).
- **Action**:
    - Drag-and-drop filters, entities, and relations.
    - Live preview of result set.
