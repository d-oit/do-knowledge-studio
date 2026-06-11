# GOAP Plan: Implement All Open Issues & PRs — 2026-06-11

## Task Analysis

**Primary Goal**: Close all 8 open issues (#280-#289) and merge all 7 open PRs (#292-#303)
**Constraints**: Local-first, strict TypeScript, atomic commits, quality gates, single PR
**Complexity**: Complex (8 issues + 7 PRs across 3 waves)

## Issue Decomposition

### Wave 1: Security + Quick Wins (3 issues)
| # | Title | Priority | Effort |
|---|-------|----------|--------|
| 282 | bug: test.db SQLite binary committed — remove & gitignore | P0/Critical | 0.5h |
| 288 | feat: Code coverage threshold enforcement + CI badge | P1 | 1h |
| 280 | feat: Context window management & token budget trimming | P1 | 3-4h |

### Wave 2: AI/LLM Features (4 issues)
| # | Title | Priority | Effort |
|---|-------|----------|--------|
| 284 | feat: Persist AI chat history via IndexedDB | P1 | 3-4h |
| 281 | feat: LLM provider abstraction — Anthropic & Ollama | P1 | 6-8h |
| 283 | feat: Orama RAG pipeline with HuggingFace embeddings | P1 | 4-6h |
| 289 | feat: Export pipeline — PDF, JSON schema, Markdown round-trip | P1 | 6-8h |

### Wave 3: PR Merges + CI Fixes (7 PRs)
| # | Title | Type | Effort |
|---|-------|------|--------|
| 303 | bump @types/node 20→25 | Dependabot | 0.5h |
| 302 | bump lucide-react 1.16→1.17 | Dependabot | 0.5h |
| 301 | bump commander 12→15 | Dependabot | 0.5h |
| 300 | bump react + @types/react | Dependabot | 0.5h |
| 299 | bump docx 9.7.0→9.7.1 | Dependabot | 0.5h |
| 293 | feat: agentic tool-calling loop | Feature | 2-3h |
| 292 | Mind map ↔ knowledge graph sync | Feature | 3-4h |

## Execution Strategy

**Hybrid**: Sequential waves with parallel tasks within each wave

```
Wave 1 (Security + Quick Wins) → Quality Gate
→ Wave 2 (AI/LLM Features) → Quality Gate
→ Wave 3 (PR Merges + CI) → Quality Gate
→ Final PR → Merge to main
```

## Quality Gates

After each wave:
- `pnpm run lint` — zero errors
- `pnpm run typecheck` — zero errors
- `pnpm run test` — all passing
- `pnpm run build` — succeeds

## Branch Strategy

- Create `feat/goap-open-issues-2026-06-11` from main
- Atomic commits with conventional commit messages
- Single PR to main after all waves complete

## Wave 1: Security + Quick Wins

### 1.1 Remove test.db (#282) — P0
- Remove `test.db` from repository
- Add `*.db` to `.gitignore`
- Verify no other binary files tracked

### 1.2 Coverage Thresholds (#288)
- Update `vitest.config.ts` with coverage thresholds
- Add CI badge to README
- Verify thresholds enforce in CI

### 1.3 Context Window Management (#280)
- Implement token counting in useChat
- Add budget trimming for context
- Truncate older messages when approaching limit

## Wave 2: AI/LLM Features

### 2.1 Chat History Persistence (#284)
- Store conversations in IndexedDB (existing DB layer)
- Load previous messages on mount
- Add "Clear conversation" functionality

### 2.2 LLM Provider Abstraction (#281)
- Create provider interface in `src/lib/llm/`
- Implement Anthropic Claude provider
- Implement Ollama (local) provider
- Update settings wizard for provider selection

### 2.3 Orama RAG Pipeline (#283)
- Integrate HuggingFace embeddings with Orama
- Implement RAG retrieval pipeline
- Add semantic search to chat context

### 2.4 Export Pipeline (#289)
- Add PDF export via @react-pdf/renderer
- Add canonical JSON schema export
- Add Markdown round-trip import/export

## Wave 3: PR Merges

### 3.1 Dependabot PRs (#299-#303)
- Merge each Dependabot PR after CI passes
- Resolve any merge conflicts
- Verify build still passes

### 3.2 Feature PRs (#292, #293)
- Review and merge agentic tool-calling loop (#293)
- Review and merge mindmap-graph sync (#292)
- Resolve any conflicts with main

## Completion Criteria

- [ ] #282: test.db removed and gitignored
- [ ] #288: Coverage thresholds enforced in CI
- [ ] #280: Context window management working
- [ ] #284: Chat history persists across reloads
- [ ] #281: Anthropic + Ollama providers available
- [ ] #283: RAG pipeline with embeddings working
- [ ] #289: PDF/JSON/Markdown export working
- [ ] All 7 PRs merged
- [ ] All CI checks passing
- [ ] Lint: 0 errors, 0 warnings
- [ ] TypeCheck: passes
- [ ] Tests: all passing
- [ ] Build: succeeds
- [ ] plans/ folder updated with progress

## References

- [INDEX.md](./INDEX.md) — Master plan index
- [GOAP.md](./GOAP.md) — GOAP goal hierarchy
- [030-goap-implement-all-open-issues.md](./030-goap-implement-all-open-issues.md) — Prior GOAP plan (completed)
- [session-2026-06-05.md](./session-2026-06-05.md) — Prior session summary
