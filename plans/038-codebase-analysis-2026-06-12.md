# Codebase Analysis — 2026-06-12

> Read-only audit of CI health, open issues/PRs, missing implementation, and
> optimization opportunities. No source code changed (scope: `plans/` only).
> Repo: `d-oit/do-knowledge-studio` · branch `main` · VERSION `0.2.5`.

## Executive Summary

| Area | State | Severity |
|------|-------|----------|
| CI on `main` | 🔴 **FAILING** since 2026-06-12 08:05 — lockfile drift blocks every job | Critical |
| Open PRs | 0 | — |
| Open issues | 7 | — |
| └ already implemented in `main`, not closed | 5 (#280, #281, #282, #283, #284) | Housekeeping |
| └ genuinely partial/missing | 2 (#288 badge, #289 PDF/JSON) | Medium |
| AGENTS.md LOC violations (>500) | 4 source files | Medium |
| Inline debt markers (TODO/FIXME/HACK) | 0 | — |

---

## 1. Failing CI (CRITICAL — fix first)

### Symptom
The `CI` workflow (`.github/workflows/ci-and-labels.yml`) fails on `main` and on
every PR. All jobs (`Quality Gate`, `Unit Tests`, …) abort at the
`Install dependencies` step which runs `pnpm install --frozen-lockfile`:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"
because pnpm-lock.yaml is not up to date with <ROOT>/package.json
* 4 dependencies are mismatched:
  - docx        (lockfile: ^9.7.0,  manifest: ^9.7.1)
  - react       (lockfile: ^19.0.0, manifest: ^19.2.7)
  - @types/node (lockfile: ^20.11.0, manifest: ^25.9.3)
  - @types/react(lockfile: ^19.0.0, manifest: ^19.2.17)
```

Reproduced locally — `pnpm install --frozen-lockfile` fails with the identical
4-dependency mismatch.

### Root cause
A burst of Dependabot PRs bumped versions in `package.json` but the merge flow
never regenerated `pnpm-lock.yaml`. Timeline from `gh run list --workflow=CI`:

| Time (UTC) | Event | CI |
|------------|-------|----|
| 07:40 | PR #305 merged (issue closeout) | ✅ last green |
| ~08:00 | PR #299 `docx@9.7.1` | cancelled |
| 08:05 | PR #303 `@types/node@25.9.3` / #300 multi | 🔴 first failure |
| 08:11 | PR #301 `commander@15` | 🔴 |
| 08:12 | PR #302 `lucide-react@1.17.0` | 🔴 |
| 08:14 | PR #307 editor loading | 🔴 |
| 08:21 | PR #292 mindmap-graph sync | 🔴 |
| 08:25 | PR #293 agentic tool loop | 🔴 |
| 08:30 | PR #308 docs/plans update | 🔴 |

Each Dependabot merge edited `package.json` only; the four specifiers above were
never written back to `pnpm-lock.yaml`, so frozen-lockfile installs fail for
everything merged afterward.

### Fix
```bash
pnpm install                 # regenerate pnpm-lock.yaml
pnpm typecheck && pnpm build # verify @types/node ^20 -> ^25 major bump is clean
git add pnpm-lock.yaml
git commit -m "fix(deps): sync pnpm-lock.yaml with package.json"
```

⚠️ `@types/node` jumps a major (`^20` → `^25`) and `commander` jumped `12 → 15`
— run `pnpm typecheck`, `pnpm test`, and `pnpm build` after regenerating to
catch typings/CLI API regressions before pushing.

### Prevention (follow-up, not in scope here)
Dependabot auto-merge (`dependabot-auto-merge.yml`) merges dep bumps without
regenerating the pnpm lockfile. Either:
- add a CI step / bot that runs `pnpm install --no-frozen-lockfile` and commits
  the updated lock on Dependabot branches, or
- configure Dependabot for the pnpm ecosystem so it updates the lockfile itself.

---

## 2. Open Pull Requests

None.

---

## 3. Open Issues — Triage (7)

PR #305 (merged 07:40) implemented most of these but the issues were never
auto-closed. Each row verified against the current `main` working tree.

| # | Title | Labels | Verified state in `main` | Recommendation |
|---|-------|--------|--------------------------|----------------|
| #282 | `test.db` SQLite binary committed | bug, security | ✅ Not tracked (`git ls-files \| grep .db` → empty); ignored | **Close** |
| #281 | LLM provider abstraction (Anthropic & Ollama) | enhancement, architecture, ai | ✅ `src/lib/llm/anthropic.ts`, `ollama.ts` present; registered via `config.ts`/`index.ts` | **Close** |
| #283 | Orama RAG + HuggingFace embeddings | enhancement, ai | ✅ `src/lib/search/orama-index.ts`: `embedding: 'vector[384]'`, `initEmbeddings()`, dynamic `@orama/plugin-embeddings` import | **Close** |
| #284 | Persist chat history via IndexedDB | enhancement, ai | ✅ `src/lib/chat-persistence.ts` wired into `src/features/ai/useChat.ts` | **Close** |
| #280 | Context window / token budget trimming | enhancement, ai | ✅ Sliding-window trim in `useChat.ts` (heuristic ~4 chars/token) | **Close** or re-scope to real tokenizer (see §5b) |
| #288 | Coverage threshold + CI badge | enhancement, ci-cd | ⚠️ **Partial** — thresholds set in `vitest.config.ts` (`lines: 40`, `statements: 40`); CI coverage job present; **README coverage badge still missing** | Keep open, narrow scope to badge |
| #289 | Export pipeline — PDF + canonical JSON + MD round-trip | enhancement, area: cli | ⚠️ **Partial** — MD import done; **no `@react-pdf/renderer`, no canonical JSON/Zod schema** (grep of `export-core.ts` + `cli/index.ts` finds none) | Keep open, see §4 |

**Net:** close 5 (#280–#284), keep 2 with reduced scope (#288, #289).

---

## 4. Missing / Incomplete Implementation

### #289 — Export pipeline gaps (only genuine missing feature)
Issue asks for four things; current state:

| Sub-feature | Status |
|-------------|--------|
| Markdown round-trip import | ✅ Implemented in `src/lib/export-core.ts` |
| PDF export via `@react-pdf/renderer` | ❌ Package not installed; only print-to-PDF exists |
| Canonical JSON schema (notes + graph + mind map) | ❌ No Zod schema, no canonical serializer |
| Headless CLI export commands | ❌ Not found in `cli/index.ts` |

Suggested approach (from issue body): add `src/features/export/pdf-exporter.tsx`
using `@react-pdf/renderer`, define a Zod canonical-state schema for
export/import round-trip, and surface both via CLI subcommands.

### #288 — README coverage badge
`vitest.config.ts` already enforces thresholds and the CI coverage job exists;
only the README badge (and optionally a Codecov/lcov upload) remains.

### Inline debt
`rg "TODO|FIXME|HACK|XXX"` over `src`, `cli`, `export` → **0 matches**. No inline
debt markers.

---

## 5. Optimization Opportunities

### 5a. AGENTS.md hard-rule violations — max 500 LOC per source file
```
591  src/features/editor/Editor.tsx
562  cli/index.ts
561  src/features/graph/GraphControls.tsx
504  src/features/graph/GraphView.tsx
858  src/db/__tests__/repository.test.ts   (test file — lower priority)
```

| File | LOC | Suggested split |
|------|-----|-----------------|
| `Editor.tsx` | 591 | Extract toolbar, backlinks panel, and history/undo-redo into sub-components |
| `cli/index.ts` | 562 | Move command handlers into `cli/commands/*` modules |
| `GraphControls.tsx` | 561 | Split control groups into smaller components |
| `GraphView.tsx` | 504 | Extract render/layout helpers into hooks/utils |
| `repository.test.ts` | 858 | Split by entity/claim/search concern |

### 5b. Token-budget accuracy (#280)
`useChat.ts` trims history with a 4-chars/token heuristic. A real tokenizer
(e.g. `gpt-tokenizer`, pure-JS, local-first friendly) would make trimming
accurate and avoid silent context-window overruns.

### 5c. Coverage threshold level (#288)
Thresholds sit at 40% (lines/statements). Once the suite stabilizes, consider
raising toward 60–70% and adding branch/function thresholds.

---

## 6. Recommended Action Order

1. **Unblock CI** — regenerate `pnpm-lock.yaml`; verify typecheck/test/build
   (§1). Highest priority — currently every merge to `main` is red.
2. **Harden Dependabot flow** so future dep bumps update the lockfile (§1).
3. **Close stale issues** #280, #281, #282, #283, #284 (§3).
4. **Re-scope** #288 → README badge; #289 → PDF + canonical JSON + CLI (§4).
5. **Refactor oversized files** to satisfy the 500-LOC rule (§5a).
6. **Optional polish:** real tokenizer (§5b), raise coverage thresholds (§5c).

---

## Appendix — Evidence Commands

```bash
gh run list --workflow=CI --limit 25      # CI timeline (green until PR #305)
gh run view 27404079185 --log-failed       # main failure: ERR_PNPM_OUTDATED_LOCKFILE
pnpm install --frozen-lockfile             # local repro: 4 deps mismatched
git ls-files | grep '\.db$'                # empty → #282 fixed
ls src/lib/llm/                            # anthropic.ts, ollama.ts → #281 fixed
grep -n "vector\[384\]" src/lib/search/orama-index.ts   # #283 fixed
grep -niE "react-pdf|canonical|zod" src/lib/export-core.ts cli/index.ts  # empty → #289 open
find src cli export -name '*.ts*' | xargs wc -l | sort -rn | awk '$1>500'  # LOC violations
```
