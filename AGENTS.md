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

## UI/UX Guardrails
- **Design Tokens ONLY**: Use CSS variables defined in `src/styles/index.css` for all colors, spacing (4px grid), and typography. No raw hex or pixel values in components.
- **Mobile First**: All layouts must be responsive. Use `@media` queries for tablet (768px) and desktop (1024px+).
- **Interactive Targets**: Minimum tap target size of 44x44px for all buttons and links.
- **No Unstyled Elements**: Every HTML element must have a corresponding class or semantic style defined in the design system.

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
