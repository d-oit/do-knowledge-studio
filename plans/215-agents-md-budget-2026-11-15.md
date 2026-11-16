# Plan 215 — AGENTS.md context budget (#1145)

250 → 132 lines. `MAX_LINES_AGENTS_MD` 250 → 150. Mirrors regenerated via
`agent-surface.py sync`; `validate` passes.

## Removal checklist (no rule lost)

| Removed from AGENTS.md | New home |
|---|---|
| 18 generic TS/React/i18n bullets (JSX escaping, catch/finally, useEffect, AbortController ×2, const assertions, memo/callback, i18n strings, Intl ×3, Zod, secrets, structuredClone, randomUUID, queueMicrotask, Segmenter) | `agents-docs/CODING-STANDARDS.md` (verbatim, grouped) |
| Named-exports rationale paragraph (5 lines) | CODING-STANDARDS.md "Module conventions", condensed to 3 |
| Arrow-function/JS-0067 rationale (7 lines) | CODING-STANDARDS.md "Module conventions", condensed to 3 |
| Test-filename bullet | CODING-STANDARDS.md "Module conventions" |
| Release rule detail (retired workflow, draft-notes offer) | Condensed to 1 line (guard enforces); history stays in git |
| Release/biome/eslint approval pleas ("stop, explain why") | Condensed to guard-enforced 1-liners; override documented in `agents-docs/HOOKS.md` |
| Codacy query playbook paragraph (4 lines) | Already in `agents-docs/GIT-WORKFLOW.md` (no copy kept) |
| Duplicate GIT-WORKFLOW pointer paragraph | Merged into single "Procedure …" line |
| Delivery flag-library paragraph (6 lines) | Condensed to 2 lines (same content) |
| "Warnings are errors" paragraph (4 lines) | Merged into Hard Rules bullet |
| Quality fast-loop detail (minimal_quality_gate parenthetical) | Trimmed; command unchanged |
| Repository shape `scripts/ · plans/` line | Extended in place (hooks doc noted) |
| Learnings bullets | Kept, tightened (LESSON-046/047 merged; 048/049 merged; 042–044 merged) |

## Verification

- `wc -l AGENTS.md` → 132 (budget 150).
- `python3 scripts/agent-surface.py validate` passes (line cap + mirrors).
- Hook prose updated separately in #1143 (`tests/validate-git-hooks.bats` now asserts the staged-aware gate).
