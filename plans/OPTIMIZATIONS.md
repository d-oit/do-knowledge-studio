# Optimizations and Future Improvements

This document outlines potential enhancements for the **do-knowledge-studio** project beyond the initial 2026 production build.

## 1. Performance & Scalability

### Database
- **Connection Pooling**: Implement a pool for SQLite connections if worker-based concurrency is introduced.
- **Incremental Exports**: Instead of full DB dumps, implement delta-based exports to Markdown/JSONL.
- **WASM Compression**: Use compressed Brotli versions of the SQLite WASM binary to reduce initial load time.

### Graph & Mind Map
- **Neighborhood Rendering**: For graphs with >1000 nodes, implement "Focus Mode" where only the N-step neighborhood of the selected entity is rendered.
- **Web Workers**: Move graph layout (Sigma.js/Graphology) and Mind Map derivation logic to a separate Web Worker to keep the UI thread jank-free.

## 2. UX & Editor

### Tiptap Extensions
- **Entity Mentions**: Create a custom extension to "@mention" entities, which automatically creates a `Link` in the database.
- **Claim Extraction**: Implement an LLM-free rule-based parser that identifies "Assertion: [text] (Source: [text])" patterns and creates `Claim` records.
- **Bi-directional Sync**: Allow editing the exported Markdown files and syncing changes back to the SQLite DB via a "Watch" command in the CLI.

### Multidimensional Views
- **Timeline View**: Add a view to visualize entities and claims along a temporal axis based on `created_at` or metadata dates.
- **Matrix View**: A TRIZ-inspired contradiction matrix view for resolving project-specific blockers.

## 3. Local AI & Synthesis

### Local LLM Integration
- **WebLLM / Transformers.js**: Integrate local-only models for summarization and claim extraction without any network calls.
- **Vector Search (WAG)**: Implement a WASM-based vector database (e.g., Orama or a custom SQLite VSS extension) for semantic search.

### Synthesis Engine
- **Source Reconciliation**: Improve the chat logic to identify conflicting claims from different sources and present them as TRIZ contradictions.

## 4. Security & Privacy
- **E2EE Sync**: If cloud sync is ever added, use End-to-End Encryption where the key never leaves the user's browser.
- **Database Snapshots**: Implement automatic, encrypted snapshots to OPFS to prevent data loss on browser cache clears.

## 5. CLI Improvements
- **Headless Mode**: Ensure every GUI action (creating entities, links) has a corresponding CLI command for power-user automation.
- **Plugin System**: Allow users to add custom Zod schemas for new entity types via a simple config file.
