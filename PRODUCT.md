# DO Knowledge Studio

## What it is

A local-first knowledge studio for rich notes, knowledge graphs, mind maps, semantic search, and AI-assisted thinking — all in the browser, no backend required.

## Target users

Knowledge workers, researchers, writers, and developers who want a personal, portable knowledge base without cloud dependency.

## Core features

- Rich text editor with markdown support
- Knowledge graph visualization
- Mind map editing
- Client-side semantic search
- AI assistant harness (opt-in: OpenRouter, local Ollama, in-browser models)
- Export (JSON, Markdown, HTML, DOCX, PDF, encrypted archive, OKF bundle, verified `.dksb` backup)
- Entity/claim/note CRUD
- Opt-in peer-to-peer sync (Yjs + WebRTC)

## Interfaces

- **Web app** — the primary product surface (Next.js).
- **`dks` CLI** (`packages/dks-cli`) — the primary executable interface for search, graph queries, bundle inspection, skills validation, and automation over an exported OKF bundle. Deterministic, read-only, CI-friendly.
- **Agent Skills** — the primary reusable workflow/distribution layer. Repository skills live in `.agents/skills/`; exported OKF bundles can carry portable skills that `dks skills` validates.
- **MCP** (`packages/dks-mcp`) — an optional interoperability adapter for MCP clients, never a required interface. The `dks` CLI covers the same read-only surface.

## Architecture

The canonical architecture document is [plans/ARCHITECTURE.md](./plans/ARCHITECTURE.md). Layering: Agent Skills → `dks` CLI → shared core (`packages/dks-core`), with MCP as an optional adapter.

## Feature status

- **Implemented**: editor, library, graph, mind map, timeline, chat, search (BM25 + semantic), export/backup, P2P sync, `dks` CLI, `dks-mcp` server, repository Agent Skills tooling.
- **Prototype (not wired in)**: at-rest encryption modules (`src/lib/studio/at-rest-crypto.ts`, `at-rest-session.ts`) exist behind a default-off flag but are not wired into live persistence.
- **Proposed**: at-rest encryption of the canonical corpus (ADR 048, gated by explicit exit criteria).
- **Deferred**: local localhost bridge and browser-native WebMCP registration (rejected for now by ADR 050).

## Platform

web

## Register

product (tool UI, not marketing)

## Tech stack

- Next.js 16 / React 19
- Tailwind CSS 4 + shadcn/ui
- Zustand for state management
- IndexedDB for canonical corpus persistence (small localStorage metadata/recovery envelope)
- TypeScript (strict)
