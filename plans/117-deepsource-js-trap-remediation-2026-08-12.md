# Plan 117 — DeepSource JS-0067/JS-R1005 Trap (2026-08-12)

Date: 2026-08-12

## Context

PR #647 (BM25 search cache) was `BLOCKED` by `DeepSource: JavaScript`
with `Blocking issues or failing metrics found`. Fixing it surfaced two
consecutive findings — a classic trap for new code.

## Findings

1. **JS-R1005 (cyclomatic complexity, "medium" risk)**: adding the
   cache `if/else` inline pushed `search` from complexity 5 to 7.
   The `.deepsource.toml` issue-pattern suppression for JS-R1005 did
   NOT prevent the check from failing — only a code-level fix works.
2. **JS-0067 (global-scope function declaration)**: extracting the
   cache into a `function getIndex()` helper immediately tripped
   JS-0067. The project convention (`const fn = () => {}`) applies to
   ALL new module-scope helpers, not just test files.

## Fixes applied (PR #647)

- Extracted cache lookup/rebuild into `const getIndex = (...) => {}`
  (arrow function), dropping `search` complexity 7 → 4.
- Added 3 cache tests (hit consistency, entity invalidation, claim
  invalidation). 15 tests total pass; benchmark avg 1.79ms on
  500 entities / 1500 claims.
- Resolved DeepSource + OwlWatch threads (replies + resolution).
- Merged squash `067f8b4`.

## Guardrails

- Keep exported functions under complexity 6; extract helpers early.
- New module-scope helpers: arrow-function `const` only.
- Do not rely on `.deepsource.toml` suppressions to unblock a failing
  check — fix the code (AGENTS.md forbids editing suppression config
  without explicit approval).

## Files changed

- `agents-docs/LESSONS.md` — LESSON-027.
- `agents-docs/lessons.jsonl` — matching entry.
- `AGENTS.md` — distilled Learnings bullet.
