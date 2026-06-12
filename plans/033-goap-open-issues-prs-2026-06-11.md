# GOAP Plan: Close Open Issues & PRs — 2026-06-11

## Task Analysis

**Primary Goal**: Close all open GitHub issues and implement missing features from plans/  
**Constraints**: Local-first, strict TypeScript, atomic commits, quality gates  
**Complexity**: Complex (8 issues, 7 tasks from plans)

## Execution Summary

### Wave 1: Quick Wins (Direct Implementation)

| Task | Issue/Plan | Status | Files |
|------|------------|--------|-------|
| Remove test.db binary | #282 | ✅ | `.gitignore`, `test.db` (deleted) |
| Add Anthropic Claude provider | #281 | ✅ | `src/lib/llm/anthropic.ts` (new) |
| Add Ollama provider | #281 | ✅ | `src/lib/llm/ollama.ts` (new) |
| Register providers in config | #281 | ✅ | `src/lib/llm/config.ts`, `src/lib/llm/index.ts` |
| CI coverage job | #288 | ✅ | `.github/workflows/ci-and-labels.yml` |

### Wave 2: Feature Implementation

| Task | Issue/Plan | Status | Files |
|------|------------|--------|-------|
| Chat history persistence (IndexedDB) | #284 | ✅ | `src/lib/chat-persistence.ts` (new), `src/features/ai/useChat.ts` |
| Context window management | #280 | ✅ | `src/features/ai/useChat.ts` |
| Backlinks UI in Editor | 33.3 | ✅ | `src/features/editor/Editor.tsx` |
| Editor toolbar expansion | 33.6 | ✅ | `src/features/editor/Editor.tsx` |
| Undo/redo in editor | 33.7 | ✅ | `src/features/editor/Editor.tsx` |
| Markdown round-trip import | #289 | ✅ | `src/lib/export-core.ts` |

### Wave 3: Quality & Testing

| Task | Status | Details |
|------|--------|---------|
| Lint | ✅ | 0 errors, 0 warnings |
| Typecheck | ✅ | `tsc --noEmit` passes |
| Tests | ✅ | 351/351 pass (30 test files) |
| Build | ✅ | `vite build` succeeds |

## Issues Addressed

| Issue | Title | Status |
|-------|-------|--------|
| #282 | test.db SQLite binary committed | ✅ Fixed — removed from git, added to .gitignore |
| #281 | LLM provider abstraction — Anthropic & Ollama | ✅ Implemented — full chat/stream support |
| #284 | Persist AI chat history via IndexedDB | ✅ Implemented — load, save, clear |
| #280 | Context window management & token budget | ✅ Implemented — sliding window with token estimation |
| #289 | Export pipeline (partial) | ✅ MD import added (PDF/JSON schema deferred) |
| #288 | Code coverage threshold enforcement | ✅ CI coverage job added |

## Plan Tasks Addressed

| Plan | Task | Status |
|------|------|--------|
| 33.3 | Backlinks UI wiring | ✅ Editor shows referenced-by entities |
| 33.6 | Editor toolbar expansion | ✅ Italic, H2, lists, code, blockquote, link |
| 33.7 | Undo/redo | ✅ TipTap History extension with UI buttons |

## Files Changed

- **New**: `src/lib/llm/anthropic.ts`, `src/lib/llm/ollama.ts`, `src/lib/chat-persistence.ts`
- **Modified**: `src/lib/llm/config.ts`, `src/lib/llm/index.ts`, `src/features/ai/useChat.ts`, `src/features/editor/Editor.tsx`, `src/features/editor/__tests__/Editor.test.tsx`, `src/lib/export-core.ts`, `.github/workflows/ci-and-labels.yml`, `.gitignore`
- **Deleted**: `test.db`

## Remaining Open Issues (Not Addressed)

| Issue | Title | Reason |
|-------|-------|--------|
| #289 | PDF via @react-pdf/renderer | Deferred — current print-to-PDF works |
| #289 | Canonical JSON schema | Deferred — needs Zod schema design |
| #283 | Orama RAG pipeline | Already implemented |
| #280 | Full token counting library | Approximation used (4 chars/token) |

## PR

- Branch: `feat/goap-closeout-issues-2026-06-11`
- PR: https://github.com/d-oit/do-knowledge-studio/pull/305
