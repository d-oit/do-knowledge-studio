# GOAP Plan 042: Close CLI Gaps + Chat Streaming Resilience — 2026-06-16

**Generated**: 2026-06-16
**Source**: Repo audit of `src/` and `cli/` (TODO/FIXME marker sweep + CLI command inventory + chat streaming review)
**Method**: Goal-Oriented Action Planning with ADR
**Orchestrator**: `goap-agent` skill
**Execution**: `parallel-execution` + `agent-coordination` swarm

---

## 1. Task Analysis

**Primary Goal**: Land the three cleanest, highest-confidence gaps surfaced by the audit:

- **G-CLI-BACKUP** — Implement the documented-but-missing `db:backup` command
- **G-CLI-CLAIM-CRUD** — Expose `claim-list`, `claim-update`, `claim-delete` (repository methods exist; CLI surface is missing)
- **G-CHAT-RESILIENCE** — Add cancellation (`AbortController`) + transient-error retry/backoff to the LLM streaming pipeline

**Constraints** (from AGENTS.md):
- Local-first only — no required backend
- Strict TypeScript — no `any`, no `as unknown as`
- Max 500 LOC per source file; CLI command files < 200 LOC
- All planning artifacts go in `plans/`, not repo root
- `pnpm` only
- Never modify `biome.json` / `eslint.config.js` / lint suppressions

**Complexity**: **Low–Medium** (3 goals, 1 ADR, 18 atomic actions, mostly parallel; final validation phase)

**Audit results summary:**

| Area | Status | Evidence |
|------|--------|----------|
| CLI `db:backup` | ❌ Missing | Documented in `docs/CLI.md:268-274`, `plans/ADRs/004-db-migration-system.md:66`, `plans/GOAP.md:184` (M4), `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md:101` test matrix; **not registered** in `cli/commands/db.ts` (95 LOC, 4 commands) |
| CLI claim CRUD | ⚠️ Partial | `cli/commands/claim.ts` (34 LOC) registers only `claim-create`; repository exposes `getClaimsByEntity`, `updateClaim`, `deleteClaim` but no CLI surface |
| Chat cancellation | ❌ Missing | `src/features/ai/useChat.ts:145-207` runs the streaming agentic loop with no `AbortController` plumbed through; no cancel button in `src/features/ai/ChatView.tsx` |
| Chat retry/backoff | ❌ Missing | `src/features/ai/useChat.ts` calls `chatStream` directly; transient `5xx` / `429` propagate as unhandled errors |
| Other Phase 4 gaps | Deferred | TRIZ matrix (no code in `src/`), semantic search auto-init (intentionally lazy, per bundle weight), hydration dedup (feature, not bug) |

---

## 2. Goal Hierarchy

```
G-CLI-BACKUP (P1, ~1h, parallel-safe)
       │
G-CLI-CLAIM-CRUD (P1, ~2h, parallel-safe)
       │
G-CHAT-RESILIENCE (P1, ~4h — touches 6 files)
       │
       ▼
G-VALIDATE (P0, full quality gate)
```

| ID | Goal | Priority | Est. Effort | Source |
|----|------|----------|-------------|--------|
| G-CLI-BACKUP | Implement `db:backup` (VACUUM INTO) | **P1** | 1h | `docs/CLI.md`, `plans/GOAP.md:184` (M4) |
| G-CLI-CLAIM-CRUD | Add `claim-list`, `claim-update`, `claim-delete` | **P1** | 2h | Repository coverage gap |
| G-CHAT-CANCEL | AbortController plumbing + cancel button | **P1** | 2h | `useChat.ts:145-207` audit |
| G-CHAT-RETRY | `withRetry` helper for transient 5xx/429 | **P1** | 2h | `useChat.ts` audit |
| G-TESTS | Extend `cli/__tests__/commands.test.ts` with new cases | **P1** | 1h | `plans/041:101` (carryover) |
| G-VALIDATE | Full quality gate | **P0** | 0.5h | `./scripts/quality_gate.sh` |

**Total estimated effort**: 7–9 hours (agent time, parallelizable)

---

## 3. Decomposition (Atomic Actions)

### Wave 1 — PLANNING (sequential, ~15 min)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| A1 | Write `plans/042-goap-cli-gaps-and-chat-resilience-2026-06-16.md` (this file) | orchestrator | File exists, 250+ lines |
| A2 | Author `plans/ADRs/016-cli-and-chat-resilience.md` documenting the three decisions | plans-writer | ADR follows the established format (Status, Context, Decision, Alternatives, Consequences, Files Affected, Verification) |

### Wave 2 — PARALLEL (CLI gaps, ~3h)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| B1 | Add `db:backup` command in `cli/commands/db.ts` (mirror `db:reset` pattern) | implementer | `pnpm run cli -- db:backup` creates `.studio-cli-backup-<timestamp>.db` and prints path; `db.ts` LOC stays under 200 |
| B2 | Add `claim-list`, `claim-update`, `claim-delete` in `cli/commands/claim.ts` | implementer | `pnpm run cli -- claim-list <entity>` prints claims; update/delete mirror `entity-update`/`entity-delete` patterns; `claim.ts` LOC stays under 90 |
| B3 | Extend `cli/__tests__/commands.test.ts` with 10+ new test cases | implementer | Covers: `db:backup` (default + custom path), `claim-list`, `claim-update` (statement + confidence), `claim-delete`, error cases (missing entity, missing claim) |

**Wave 2 gate**: B1+B2 land a single PR (`feat(cli): add db:backup and claim list/update/delete commands`); B3 lands as a follow-up test PR in the same wave.

### Wave 3 — PARALLEL (Chat resilience, ~4h)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| C1 | Add `AbortController` ref + `cancel()` to `src/features/ai/useChat.ts` | implementer | New `cancel` returned from hook; abort ref guards against double-abort; chat loop checks `signal.aborted` between agentic rounds |
| C2 | Add `signal` parameter to `chatStream` in `src/lib/llm/types.ts` (and call sites) | implementer | All 4 providers (`anthropic`, `openrouter`, `kilo`, `ollama`) pass `signal` to `fetch(...)` |
| C3 | Add `withRetry` helper + wire into `useChat.ts` per-round call | implementer | Helper retries `5xx` and `429` with exponential backoff (3 attempts, 500ms base); `AbortError` is excluded and not retried; non-retryable errors throw immediately |
| C4 | Add cancel button in `src/features/ai/ChatView.tsx` (visible while `isStreaming`) | implementer | Button calls `cancel()`; hidden when not streaming; `aria-label="Cancel response"`; respects design tokens |

**Wave 3 gate**: C1-C4 land a single PR (`feat(ai): add cancellation and retry to chat streaming`).

### Wave 4 — VALIDATION (gates before merge)

| # | Action | Agent | Quality Gate |
|---|--------|-------|--------------|
| D1 | `pnpm run lint` | test-runner | 0 errors, 0 warnings |
| D2 | `pnpm run typecheck` | test-runner | 0 errors |
| D3 | `pnpm run test` | test-runner | All tests pass (currently 542+); new CLI + retry tests included |
| D4 | `pnpm run build` | test-runner | `dist/` produced without errors |
| D5 | `./scripts/minimal_quality_gate.sh` | test-runner | Exits 0 |
| D6 | Update `plans/INDEX.md` with new plan + ADR entry | plans-writer | INDEX renders cleanly; new plan listed in `Quick Reference — Active Plans`; new ADR listed in `ADR Index` |

---

## 4. Strategy Selection

| Wave | Strategy | Rationale |
|------|----------|-----------|
| 1 | **Sequential** | ADR (A2) is needed before implementation, but can be drafted in parallel with the plan itself |
| 2 | **Parallel** | B1 (db:backup) and B2 (claim CRUD) touch different files; B3 tests both |
| 3 | **Parallel** | C1-C4 touch different files (useChat, types, ChatView); providers are independent edits |
| 4 | **Sequential** | Quality gates must each pass before next runs |

**Swarm composition** (one message per wave, parallel calls):

- **Wave 1**: 1 `plans-writer` (A2 ADR)
- **Wave 2**: 2 `implementer`s (B1+B2 split, then B3 tests) — can collapse to 1 agent for the full CLI change
- **Wave 3**: 2 `implementer`s (C1+C3 useChat + retry, C2+C4 providers + UI) — can collapse to 1 agent for the full chat change
- **Wave 4**: 1 `test-runner` + 1 `plans-writer` (D6)

---

## 5. Agent Assignment

| Action | Agent | Skill |
|--------|-------|-------|
| Plan + ADR authoring | `plans-writer` | `goap-agent`, `task-decomposition` |
| CLI implementation (B1, B2) | `implementer` | `code-quality` (mirror existing patterns) |
| CLI tests (B3) | `implementer` | `testing-strategy`, `testdata-builders` |
| Chat useChat refactor (C1, C3) | `implementer` | `code-quality`, `local-chat-policy` |
| Provider signal plumbing (C2) | `implementer` | `code-quality` (mechanical) |
| ChatView cancel button (C4) | `implementer` | `impeccable` (UI conventions) |
| Quality gates | `test-runner` | `test-runner`, `self-fix-loop` |
| INDEX update | `plans-writer` | — |

---

## 6. Execution Plan

### Phase 1 — Wave 1 (PARALLEL, ~15 min)
- 1 plans writer — drafts ADR `016` and writes to `plans/ADRs/`
- **Quality gate**: `ls plans/ADRs/016-*.md` returns 1 file; `cat plans/042-...md` ≥ 250 lines

### Phase 2 — Wave 2 (PARALLEL, ~3h agent time)
- 1 implementer for B1+B2 (CLI commands)
- 1 implementer for B3 (tests, runs after B1+B2 land so the test imports resolve)
- **Quality gate**: `pnpm run cli -- db:backup` and `pnpm run cli -- claim-list <entity>` work; B3 tests pass

### Phase 3 — Wave 3 (PARALLEL, ~4h agent time)
- 1 implementer for C1+C3 (useChat hook + retry helper)
- 1 implementer for C2+C4 (provider signals + UI button)
- **Quality gate**: `pnpm run typecheck` clean; manual cancel + retry work in dev

### Phase 4 — Wave 4 (VALIDATION, ~30 min)
- All quality scripts in sequence
- Fix anything red via `self-fix-loop` skill
- Update `plans/INDEX.md`

---

## 7. Quality Gates (per phase)

| Phase | Gate | Script |
|-------|------|--------|
| 1 | Plan + ADR authored | `ls plans/042-*.md plans/ADRs/016-*.md` |
| 2 | CLI commands work | `pnpm run cli -- db:backup` exits 0; `pnpm run test cli/__tests__/commands.test.ts` passes |
| 3 | Chat resilience works | `pnpm run typecheck` clean; `pnpm run test src/features/ai/__tests__/` passes; manual cancel test in dev |
| 4 | Full quality | `./scripts/minimal_quality_gate.sh` exits 0 |

---

## 8. Risk Register

| Risk | Mitigation |
|------|------------|
| `db:backup` SQL injection via user-supplied path | `outPath.replace(/'/g, "''")` escapes single quotes; path is CLI arg, not external input — same pattern flagged in `analysis/SWARM_ANALYSIS.md:240` (S-08) |
| `claim.ts` grows past 200 LOC | Estimated 90 LOC after changes; well under the per-file budget from taste |
| `useChat.ts` already 200+ LOC after retry helper | Estimated 245 LOC after changes; still under 500 LOC; `withRetry` lives as a small pure helper at module scope |
| AbortController not honored by all 4 providers | All providers use `fetch(...)`; `signal` is a first-class `fetch` option. Verify in each provider's `sendStreamingRequest` |
| `withRetry` retries `AbortError` (causes double-abort) | Explicit `isRetryable` check excludes `AbortError` and any error with `name === 'AbortError'` |
| Cancel button looks out of place in ChatView | Reuse the existing input-area button styles; match the `Editor.tsx` toolbar conventions; follow `impeccable` skill |
| `cli/__tests__/commands.test.ts` already 200+ LOC | Add 10 new test cases (estimate +120 LOC); total ~320 LOC, still under 500 |

---

## 9. Dependencies (action → action)

```
A1 ──┐
A2 ──┴──→ (gate: plan + ADR done) ──→ B1 ─┐
                                           ├──→ (gate: wave 2 done) ──→ C* ──→ D*
                              B2 ──┤        │
                              B3 ──┘        │
                                             
`D*` = all of D1-D6 must pass.
```

---

## 10. Success Criteria

- [ ] `plans/042-goap-cli-gaps-and-chat-resilience-2026-06-16.md` committed
- [ ] `plans/ADRs/016-cli-and-chat-resilience.md` committed
- [ ] `db:backup` command registered in `cli/commands/db.ts`
  - [ ] Default path: `.studio-cli-backup-<timestamp>.db`
  - [ ] Custom path via positional arg
  - [ ] Uses `VACUUM INTO` per `docs/CLI.md`
- [ ] `claim-list`, `claim-update`, `claim-delete` registered in `cli/commands/claim.ts`
  - [ ] `claim-list <entity-name>` prints claims for entity
  - [ ] `claim-update <id> --statement "..." --confidence 0.8` updates and confirms
  - [ ] `claim-delete <id>` removes and confirms
- [ ] 10+ new test cases in `cli/__tests__/commands.test.ts`
- [ ] `AbortController` plumbed through `useChat.ts` → `chatStream` → 4 provider `fetch` calls
- [ ] Cancel button visible in `ChatView` while `isStreaming`, hidden otherwise
- [ ] `withRetry` helper in `useChat.ts` with 3 attempts, 500ms base, exponential backoff
- [ ] `withRetry` does NOT retry `AbortError` or other non-transient errors
- [ ] `withRetry` retries `5xx` and `429` responses
- [ ] All quality gates (D1-D6) pass
- [ ] `plans/INDEX.md` reflects new plan + ADR

---

## 11. Post-execution

- Update `plans/INDEX.md`:
  - Add `042-goap-cli-gaps-and-chat-resilience-2026-06-16.md` to **Quick Reference — Active Plans**
  - Add ADR `016` to **ADR Index**
  - Refresh health scores:
    - **Implementation Completeness: 88 → 90** (CLI surface complete, chat resilient)
    - **Code Quality: 85 → 86** (no more silent-catch in chat loop; retry path is explicit)
    - **Test Coverage: 85 → 86** (10+ new CLI test cases)
- Mark this plan (042) as the closure for the `db:backup` item that has been tracked across plans 19, 35, and 041.

---

## 12. ADR Index (new)

| # | Title | Status | Notes |
|---|-------|--------|-------|
| 016 | CLI Surface Completion + Chat Streaming Resilience | 📝 Proposed | `db:backup`, claim CRUD, AbortController, retry/backoff |

---

## 13. Evidence Appendix (file paths and line numbers)

| Evidence | Location |
|----------|----------|
| `db:backup` documented | `docs/CLI.md:268-274` |
| `db:backup` in ADR | `plans/ADRs/004-db-migration-system.md:66` |
| `db:backup` in GOAP | `plans/GOAP.md:184` (M4) |
| `db:backup` in test matrix | `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md:101` |
| `db:backup` missing from CLI | `cli/commands/db.ts:1-95` (registers only `db:migrate`, `db:rollback`, `db:status`, `db:reset`) |
| `claim` CLI surface gap | `cli/commands/claim.ts:1-34` (registers only `claim-create`) |
| Repository methods exist | `src/db/repository.ts` (`getClaimsByEntity`, `updateClaim`, `deleteClaim`) |
| `useChat` agentic loop | `src/features/ai/useChat.ts:145-207` |
| 4 LLM providers | `src/lib/llm/{anthropic,openrouter,kilo,ollama}.ts` |
| SWARM_ANALYSIS SQL escaping note | `analysis/SWARM_ANALYSIS.md:240` (S-08) |
| Taste — CLI command file budget | `.commandcode/taste/taste.md` (200 LOC per `cli/commands/*.ts`) |
| Taste — test file path | `.commandcode/taste/taste.md` (`__tests__/` mirrors source path) |
| ADR format reference | `plans/ADRs/014-test-architecture.md`, `plans/ADRs/015-jsdoc-policy.md` |
