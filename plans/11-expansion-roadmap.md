# Plan 11: Expansion Roadmap & New Features

**Date**: 2026-05-07
**Status**: PROPOSED
**Goal**: Identify high-value features beyond the core MVP that align with the local-first, AI-augmented knowledge studio vision.

## 11.1 Auto-Synthesis Agent (Local-First Hybrid)
**Concept**: A background agent that periodically analyzes the knowledge base to suggest connections or identify contradictions using local heuristics and external document resolution.
- **Action**:
    - Implement `SynthesisAgent` in `src/lib/agents/`.
    - **Local Heuristics**: Use Orama vector similarity scores and shared keyword/tag overlap to identify potential links.
    - **TRIZ Contradiction Audit**: Apply `triz-analysis` skill to identify semantic contradictions between claims.
    - **External Verification**: Use `do-web-doc-resolver` (utilizing Tavily, Firecrawl, or Tinyfish backends) to fetch external documentation for a concept pair and verify if they are commonly linked in existing literature (using compact markdown synthesis).
    - Present suggestions to the user in a "Synthesis Inbox" for manual approval (Local-first "human-in-the-loop").

## 11.2 Local-First P2P Sync
**Concept**: Sync between two devices on the same local network without a server.
- **Action**:
    - Research `WebRTC` or `Local Area Network` discovery.
    - Implement a "Sync QR Code" to pair devices.
    - Use `sqlite-wasm` delta syncing to merge changes.

## 11.3 Voice-to-Knowledge
**Concept**: Use browser speech-to-text to create entities and claims hands-free.
- **Action**:
    - Use `Web Speech API` for live transcription.
    - Implement NLP intent parsing to extract `(Entity, Relation, Target)` from spoken sentences.

## 11.4 Interactive TRIZ Matrix Tool
**Concept**: A dedicated UI for resolving technical contradictions using the TRIZ matrix.
- **Action**:
    - Create `src/features/triz/TrizMatrix.tsx`.
    - Allow users to select "Improving Parameter" and "Worsening Parameter".
    - Fetch "Inventive Principles" and provide examples via AI agent.

## 11.5 Encrypted Markdown Export (E2EE)
**Concept**: Export to a format that can be stored on untrusted cloud drives safely.
- **Action**:
    - Use `Web Crypto API` (AES-GCM).
    - Bundle encrypted markdown files with a lightweight "Reader" HTML file that asks for the password.

## 11.6 Visual Query Builder
**Concept**: A node-based UI (like React Flow) to build complex SQLite/Orama queries visually.
- **Action**:
    - Drag-and-drop filters, entities, and relations.
    - Live preview of result set.
