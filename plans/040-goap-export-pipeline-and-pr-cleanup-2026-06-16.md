# GOAP Plan: Complete Export Pipeline & Resolve Open PRs — 2026-06-16

> **Historical Note**: This plan references the retired Vite/SQLite/Orama/CLI architecture (superseded by ADR 018 — Next.js + Zustand + localStorage, 2026-07). Remaining unchecked items were completed in later plans (090–096). Retained for historical context only.

**Generated**: 2026-06-16
**Source**: GitHub issue #289 (export pipeline), PRs #309 & #311 (CI red), Dependabot PRs #318–#323
**Method**: Goal-Oriented Action Planning with swarm execution and ADRs
**Orchestrator**: `goap-agent` skill
**Execution**: `parallel-execution` + `agent-coordination` swarm

---

## 1. Task Analysis

**Primary Goal**: Land all three workstreams in one coordinated wave:
- **G-EXPORT-PIPELINE** — Complete Issue #289 (PDF, JSON schema v1.0, Markdown round-trip, CLI commands)
- **G-PR-CLEANUP** — Resolve PRs #309 & #311 (CI red) and merge Dependabot batch #318–#323
- **G-PLANS-DOCS** — Author/update GOAP + ADRs in `plans/` so the next agent has full context

**Constraints** (from AGENTS.md):
- Local-first only — no required backend
- Strict TypeScript — no `any`, no `as unknown as`
- Max 500 LOC per source file
- No magic numbers; no `VITE_` env for API keys
- Markdown is import/export only — never canonical truth
- Never modify `biome.json` / `eslint.config.js` / lint suppressions
- All planning artifacts go in `plans/`, not repo root
- `pnpm` only

**Complexity**: **Complex** (3 goals, 3 ADRs, 18+ atomic actions, parallel + sequential phases)

**Repository state observed**:
- `cli/` contains only `index.ts` + `db.ts` (no `cli/commands/` subdir)
- `src/lib/export-core.ts` has `parseMarkdownImport` and `generateJsonExport` but no schema interface
- `ExportPanel.tsx` already exports DOCX via dynamic `import('docx')`
- `@react-pdf/renderer` and `gray-matter` are NOT in `package.json`
- PR #309 references `cli/commands/{claim,db,entity,export,link,note,search}.ts` files that do not exist locally
- Codacy + DeepSource failing on both #309 and #311
- Zod is at 3.25.76, Dependabot #320 wants to bump to 4.4.3

---

## 2. Goal Hierarchy

```
G-PR-CLEANUP (P0, blocker for G-EXPORT-PIPELINE)
       │
       ▼
G-PLANS-DOCS (P0, parallel — author first)
       │
       ▼
G-EXPORT-PIPELINE (P1)
   ├── G-EXPORT-PDF
   ├── G-EXPORT-JSON-SCHEMA
   ├── G-EXPORT-MD-ROUNDTRIP
   └── G-EXPORT-CLI-COMMANDS
```

| ID | Goal | Priority | Est. Effort | Plan |
|----|------|----------|-------------|------|
| G-PR-CLEANUP | Resolve red CI on #309, #311; merge Dependabot batch | **P0** | 2-3h | 040.A |
| G-PLANS-DOCS | Author GOAP + 3 ADRs + INDEX update | **P0** | 1-2h | 040.B |
| G-EXPORT-PDF | `@react-pdf/renderer` + single/multi-note PDF | **P1** | 3-4h | 040.C |
| G-EXPORT-JSON-SCHEMA | `KnowledgeStudioExport` v1.0 with validation | **P1** | 2-3h | 040.D |
| G-EXPORT-MD-ROUNDTRIP | `gray-matter` import/export, frontmatter parity | **P1** | 2h | 040.E |
| G-EXPORT-CLI-COMMANDS | `cli/commands/` extraction + `export`/`import` subcommands | **P1** | 3-4h | 040.F |

---

## 3. Decomposition (Atomic Actions)

### Wave 1 — PARALLEL (no inter-deps)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| A1 | Write `plans/040-...md` (this file) | orchestrator | File exists, 200+ lines |
| A2 | Author `plans/ADRs/010-export-schema-v1.md` | plans-writer | ADR format matches #006 |
| A3 | Author `plans/ADRs/011-cli-command-extraction.md` | plans-writer | Documents split rationale |
| A4 | Author `plans/ADRs/012-pdf-export-strategy.md` | plans-writer | Justifies `@react-pdf/renderer` choice |
| A5 | Rebase PR #311 onto latest `main` and re-run CI | github-pr | Quality Gate + Unit Tests + Codacy + DeepSource pass |
| A6 | Inspect PR #309 — is it still relevant or should it close? | github-pr | Decision recorded in PR comment |
| A7 | Merge Dependabot PRs #318–#323 sequentially | github-pr | Each PR shows green CI before next merge |

### Wave 2 — SEQUENTIAL (after Wave 1 PR cleanup)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| B1 | `pnpm add @react-pdf/renderer gray-matter jszip` | implementer | `pnpm-lock.yaml` updated, no peer-dep errors |
| B2 | Create `src/lib/export-schema.ts` with `KnowledgeStudioExport` interface + Zod validators | implementer | `tsc --noEmit` clean, no `any` |
| B3 | Create `src/features/export/pdf-exporter.tsx` (single + multi-note) | implementer | Unit tests for `exportNoteToPDF` |
| B4 | Extend `src/lib/export-core.ts` with `exportToJson`/`importFromJson` (schema-validated) | implementer | Round-trip test: export → import → deep-equal |
| B5 | Extend `src/lib/markdown-importer.ts` with `gray-matter` frontmatter support | implementer | Round-trip test on 5 fixture files |
| B6 | Refactor `src/lib/export-core.ts` to expose `exportNoteToMarkdown` (frontmatter round-trip safe) | implementer | Existing fixtures pass unchanged |

### Wave 3 — SEQUENTIAL (after B1–B6)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| C1 | Create `cli/commands/` directory and 7 command modules (claim, db, entity, export, link, note, search) per #309 design | implementer | Each file < 200 LOC, strict types |
| C2 | Wire `cli/commands/export.ts` to `exportToJson`, `exportNoteToMarkdown`, `exportNoteToPDF` | implementer | CLI test: `node dist/cli export json -o ./out` produces file |
| C3 | Wire `cli/commands/import.ts` to `importFromJson`, `importFromMarkdown` | implementer | CLI test: import + export round-trip |
| C4 | Update `cli/index.ts` to mount `cli/commands/*.ts` programs | implementer | `pnpm run cli -- --help` lists all subcommands |
| C5 | Extend `src/features/export/ExportPanel.tsx` with PDF button, Import drop-zone | implementer | Manual smoke test in browser, Playwright E2E test |

### Wave 4 — VALIDATION (gates before merge)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| D1 | `pnpm run lint` | test-runner | 0 errors, 0 warnings |
| D2 | `pnpm run typecheck` | test-runner | 0 errors |
| D3 | `pnpm run test` | test-runner | All tests pass (currently 542, expect 560+) |
| D4 | `pnpm run test:coverage` | test-runner | export/import modules ≥ 90% coverage |
| D5 | `pnpm run build` | test-runner | `dist/` produced without errors |
| D6 | `pnpm run test:e2e` | test-runner | Critical flows pass (export, import) |
| D7 | `./scripts/quality_gate.sh` | test-runner | Exits 0 |
| D8 | Update `plans/INDEX.md` with new plan + ADR entries | plans-writer | INDEX renders in 5s |

---

## 4. Strategy Selection

| Wave | Strategy | Rationale |
|------|----------|-----------|
| 1 | **Parallel** | ADRs, PR rebase, Dependabot merges have no deps |
| 2 | **Sequential** | B2–B6 share `export-core.ts` — risk of merge conflicts if parallel; B3 + B5 can be parallel since they touch different files |
| 3 | **Sequential** | C1 must exist before C2–C4; UI (C5) last |
| 4 | **Sequential** | Quality gates must each pass before next runs |

**Swarm composition** (one message per wave, parallel `explore` / `plan` calls):

- **Wave 1**: 1 `plans-writer` + 2 `github-pr` agents (different PRs)
- **Wave 2**: 1 `implementer` for the export-core refactor (atomic), with B3 + B5 in parallel
- **Wave 3**: 1 `implementer` (C1 first, then C2–C4 in parallel, C5 last)
- **Wave 4**: 1 `test-runner` with quality-gate skill

---

## 5. Agent Assignment

| Action | Agent | Skill |
|--------|-------|-------|
| Plans/ADRs | `plans-writer` | `goap-agent`, `task-decomposition` |
| PR operations | `github-pr` | `git-github-workflow`, `atomic-commit` |
| Dependabot batch | `github-pr` | `github-workflow` |
| Code (export schema) | `implementer` | `database-schema-migrations`, `api-design-first` |
| Code (PDF exporter) | `implementer` | `impeccable`, `testing-strategy` |
| Code (CLI commands) | `implementer` | `agent-coordination`, `parallel-execution` |
| Quality gates | `test-runner` | `test-runner`, `codacy`, `self-fix-loop` |

---

## 6. Execution Plan

### Phase 1 — Wave 1 (PARALLEL, ~30 min)
- Spawn 3 explore/plan agents in one message:
  1. Plans writer — drafts 3 ADRs (`010`, `011`, `012`) and writes to `plans/ADRs/`
  2. PR fixer — rebases #311, inspects #309, opens issue comment
  3. Dependabot merger — merges #318 → #323 sequentially
- **Quality gate**: `ls plans/ADRs/010-* 011-* 012-*` returns 3 files; PR comments posted

### Phase 2 — Wave 2 (SEQUENTIAL, ~6h agent time)
- One implementer works on the shared `export-core.ts` to avoid conflicts
- Can be split: B3 (PDF) + B5 (MD import) in parallel, B2 + B4 + B6 sequential
- **Quality gate**: `pnpm run typecheck` clean after each action

### Phase 3 — Wave 3 (SEQUENTIAL, ~5h agent time)
- C1 creates the `cli/commands/` skeleton (what PR #309 promised but didn't deliver)
- C2–C4 wire commands
- C5 updates UI last (most user-facing risk)
- **Quality gate**: `pnpm run cli -- export json -o /tmp/test.json` produces valid output

### Phase 4 — Wave 4 (VALIDATION, ~1h)
- All quality scripts in sequence
- Fix anything red via `self-fix-loop` skill
- Update `plans/INDEX.md`

---

## 7. Quality Gates (per phase)

| Phase | Gate | Script |
|-------|------|--------|
| 1 | ADRs authored | `ls plans/ADRs/01{0,1,2}-*.md` |
| 1 | PRs resolved | `gh pr list --state open` returns 0 from #309, #311, #318–#323 |
| 2 | Typecheck | `pnpm run typecheck` |
| 3 | CLI smoke | `pnpm run build && node dist/cli/index.js export json -o /tmp/out.json && test -s /tmp/out.json` |
| 4 | Full quality | `./scripts/quality_gate.sh` |

---

## 8. Risk Register

| Risk | Mitigation |
|------|------------|
| `@react-pdf/renderer` bundle size bloat | Dynamic import in `ExportPanel.tsx` (already pattern for `docx`) |
| `gray-matter` peer-dep issues | Check `pnpm-lock.yaml` after install; pin to ^4.0.3 |
| PR #309 conflicts with new `cli/commands/` | Close #309 with note pointing to new branch |
| Zod v3 → v4 breaking (Dependabot #320) | Zod 4.4.3 already PR'd; verify export-core uses compatible schema API |
| Codacy fails on `cli/commands/*.ts` | Run `pnpm run lint` locally before push |
| `parseMarkdownImport` already exists — risk of duplicate logic | Refactor existing function to delegate to new `markdown-importer.ts` |

---

## 9. Dependencies (action → action)

```
A1 ──┐
A2 ──┤
A3 ──┼──→ (gate: plans + PRs done) ──→ B2 ──→ B4 ──→ B6 ──→ C1 ──→ C2 ──→ C4 ──→ C5 ──→ D*
A4 ──┤                                  │                 │
A5 ──┤                                  ├──→ B3 (parallel) ──┤
A6 ──┤                                  └──→ B5 (parallel) ──┘
A7 ──┘
```

`D*` = all of D1–D8 must pass.

---

## 10. Success Criteria

- [ ] ADRs `010`, `011`, `012` committed in `plans/ADRs/`
- [ ] PR #311 rebased and green; merged
- [ ] PR #309 closed (or rebased) with explanation
- [ ] Dependabot PRs #318–#323 all merged
- [ ] `@react-pdf/renderer` + `gray-matter` + `jszip` in `package.json`
- [ ] `src/lib/export-schema.ts` defines `KnowledgeStudioExport` v1.0 with Zod validators
- [ ] `src/features/export/pdf-exporter.tsx` exports single + multi-note PDF
- [ ] `src/lib/markdown-importer.ts` round-trips frontmatter
- [ ] `cli/commands/{claim,db,entity,export,link,note,search}.ts` exist, all < 200 LOC
- [ ] `pnpm run cli -- export json -o ./out.json` works
- [ ] `pnpm run cli -- import ./fixtures/sample.md` works
- [ ] All quality gates (D1–D7) pass
- [ ] `plans/INDEX.md` reflects new state
- [ ] Issue #289 closed with PR link
- [ ] Coverage on `src/lib/export-*.ts` ≥ 90%

---

## 11. Post-execution

- Update `plans/INDEX.md` health scores:
  - Architecture: 80 → 82 (cli/commands split)
  - Implementation Completeness: 75 → 88 (PDF + round-trip + CLI export)
  - Test Coverage: 60 → 70 (export tests added)
- Close Issue #289 referencing the implementation PR
- Create `plans/041-post-export-cleanup-2026-XX-XX.md` if follow-ups remain
