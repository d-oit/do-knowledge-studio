# AGENTS.md

> Production-ready harness for do-knowledge-studio.
> Local-first | TRIZ-based | Structured Data

## HARD RULES
- **Local-first ONLY**: No required backend.
- **SQLite (WASM) + OPFS**: Primary storage.
- **Markdown is NOT canonical truth**: Use only for export/import.
- **Strict TypeScript**: NO `any`.

## Project Stack
- **DB**: SQLite WASM + OPFS
- **Core**: React + Vite + TypeScript
- **Visuals**: Sigma.js, Mind Elixir
- **Editor**: Tiptap

## Quality Gate
- Run `pnpm test` (Vitest)
- Run `pnpm lint`
- Run `pnpm typecheck`

## Directory Structure
- `/src/db`: Schema and Repository (Repository Pattern).
- `/src/features`: Domain components (Editor, Graph, MindMap, Chat).
- `/src/lib`: Core utilities (Validation, Logging, Errors).
- `/cli`: CLI tool for admin tasks.
- `/plans`: Architectural intent (TRIZ).

## Skills
- `triz-analysis`: Applying TRIZ to knowledge management.
- `local-chat-policy`: Synthesis without data leakage.
- `validation-checklist`: Ensuring schema integrity.

## Single Source of Truth
This file (`AGENTS.md`) is the source of truth for all agents. Agent-specific instructions live in `.agents/`.
