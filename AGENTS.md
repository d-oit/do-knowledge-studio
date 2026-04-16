# AGENTS.md

> Production-ready harness for do-knowledge-studio.
> Local-first | TRIZ-based | Structured Data

## HARD RULES
- **Local-first ONLY**: No required backend.
- **SQLite (WASM) + OPFS**: Primary storage.
- **Markdown is NOT canonical truth**: Use only for export/import.
- **Strict TypeScript**: NO `any`.

## Project Stack
- **DB**: SQLite WASM + OPFS (with FTS5)
- **Search**: Orama (Local RAG)
- **Core**: React + Vite + TypeScript
- **Visuals**: Sigma.js, Mind Elixir
- **Editor**: Tiptap

## Quality Gate
- Run `npm test` (Vitest)
- Run `npm run lint`
- Run `npm run typecheck`

## UI/UX Guardrails
- **Design Tokens ONLY**: Use CSS variables defined in `src/styles/index.css`.
- **Mobile First**: All layouts must be responsive.
- **Interactive Targets**: Minimum tap target size of 44x44px.

## CLI Commands
- `sync <dir>`: Sync markdown files to the local database.
- `export --format site`: Generate a static site from your knowledge base.
- `entity-create <name>`: Create a new entity via CLI.
- `claim-create <entity> <statement>`: Add a claim via CLI.

## Skills
- `triz-analysis`: Applying TRIZ to knowledge management.
- `local-chat-policy`: Synthesis without data leakage using Orama search.
- `validation-checklist`: Ensuring schema integrity.

## Single Source of Truth
This file (`AGENTS.md`) is the source of truth for all agents. Agent-specific instructions live in `.agents/`.
