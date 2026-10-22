# Plan 183 — Split oversized automation scripts and scope Markdown fixes

**Date:** 2026-10-22  
**Status:** Done — Codacy blocking fix and full repository quality gate passed

## Summary

Two automation entrypoints exceeded the repository’s 500-line source limit:
`quality_gate.sh` was 844 lines and `self-fix-loop.sh` was 651 lines. Their
language-check blocks and GitHub/CI phases are now separate shell libraries.
The self-fix loop also used a repository-wide Markdown rewrite that ignored the
quality gate’s Git-aware file enumeration, so it could modify ignored artifacts
and vendored skills.

## Changes

- Extracted language-specific checks into
  `scripts/lib/language-checks.sh`; `scripts/quality_gate.sh` now loads the
  module fail-closed and aggregates its result. The entrypoint is 439 lines and
  the library is 493 lines.
- Extracted the self-fix loop’s JSON helpers and GitHub/CI phases 1–4 into
  `scripts/lib/self-fix-github.sh`. The entrypoint is 349 lines and the library
  is 316 lines.
- Replaced the Markdown part of the self-fix blanket whitespace pass with
  `trim_markdown_trailing_whitespace` from the shared repository-owned file
  enumeration. Ignored Playwright reports and vendored skill Markdown are no
  longer rewritten.
- Fixed a pending-check parser bug exposed by the extraction test: calling
  `sys.exit(0)` inside a bare Python `except` raised `SystemExit`, which the
  handler caught, so the helper printed both `true` and `false`. It now prints
  one result without exiting inside the exception handler.
- Includes `ACTION_REQUIRED` in blocking CI failures; a Codacy-only result now
  reaches `phase_analyze_failures` as a failure instead of the success path.
- Added BATS coverage for language-check aggregation, fail-closed loading,
  scoped Markdown rewrites, and Codacy-only ACTION_REQUIRED analysis failures.

## Findings from the review pass

Each finding was reproduced before it was fixed, and each new assertion was
observed to **fail** with the defect re-injected.

| # | Finding | Evidence | Resolution |
| --- | --- | --- | --- |
| F1 | `ACTION_REQUIRED` was excluded from failures, so a Codacy-only result reached the "no failures" path and the loop exited 0 — a false green for a check AGENTS.md treats as merge-blocking. | `json_get_failed_checks` state list omitted it; `tests/self-fix-loop.bats` pinned the exclusion. | Included in the blocking set; the exclusion assertion replaced by a Codacy-only analysis regression. Injection check: with the old state list the new tests fail. |
| F2 | An **unparsable** `gh pr checks` payload was folded into the success shape: `phase_analyze_failures` returned `"[]"` with status 0, so `main` reported "All checks pass!" and exited 0 for checks it could not read. | Reproduced: `phase_analyze_failures 'not json'` → stdout `[]`, status `0`. | The parse-error path now reports through `error`, returns 2, and `main` exits 5 instead of reporting success. Injection check: reverting `return 2` to `return 0` fails both new tests. |
| F3 | Deleting the stale source-text test in `workflows.test.ts` removed the only coverage for two real behaviours: the gate invoking `bats tests/`, and a `tests/`-only change selecting the tooling scope. | The deleted assertions were `toContain('bats tests/')` and `toMatch(/\^tests\//)`; no behavioural test covered either. | Replaced with BATS behaviour tests. Injection check: pointing the suite at `bats .` fails the first; dropping the `^tests/` mapping fails the second. |
| F4 | `phase_fix` still described `ACTION_REQUIRED` as "usually not blocking" and skipped it silently, contradicting the now-blocking parser and the `self-fix-loop` skill's Codacy triage row. | `scripts/self-fix-loop.sh` comment + `warn` text. | Comment and message name the blocker and the `codacy` skill; the failure still counts as unresolved, so the loop cannot claim success while it stands. |

A second, independent review round over the extracted library found three more
false-green paths. All three were reproduced end to end before being fixed.

| # | Finding | Evidence | Resolution |
| --- | --- | --- | --- |
| F5 | `phase_analyze_failures` printed its human-readable failure list on **stdout** — the channel `main` captures and hands to `phase_fix`, which parses it as JSON. Every genuine CI failure arrived as unparsable text, so the fix phase reported "No failures to fix." and nothing was ever remediated. | `failed_jobs=$(phase_analyze_failures '[{"name":"Lint","state":"FAILURE"}]')` returned the display line (indented, `❌ Lint: FAILURE`) followed by the array, so `json.load` on it raised. | The display moved to stderr (`>&2 2>/dev/null`); stdout carries only the array. Covered by a stream-separation test and an end-to-end "Investigating: Lint (FAILURE)" test, both shown failing with the display restored to stdout. |
| F6 | The documented git-failure abort was unreachable: `if ! phase_commit_and_push; then local exit_code=$?` reads the status of the **negation**, always 0. A failed push was retried, the next iteration found a clean tree, and the loop exited **0** with the commit never landed. | Fixture with no remote: exit 0 and `[ERROR] Push failed.` in the same run. | The status is captured from the command itself and a hard failure aborts with exit 2. Covered by a push-failure test, shown failing with the old idiom restored. |
| F7 | Every helper masked its own failure with the **passing** value (`\|\| echo '[]'`, `\|\| echo 'false'`), and the code that detected an unreadable payload was python itself — so an unusable interpreter produced "All checks pass!" and exit 0 over a payload full of FAILUREs. | Fixture with `python3` exiting 127 and a FAILURE payload: exit 0, "✓ All checks pass!". | `json_get_failed_checks` signals an unreadable payload through its exit status (diagnostic on stderr, no masking fallback) and the analyzer fails closed on any non-zero status, so detection no longer depends on the failed interpreter. Covered by a broken-interpreter test expecting exit 5, shown failing with the masking restored. |
| F8 | The PR's `Shell Script Security Analysis` and `Security Scan Summary` checks failed: `ludeeus/action-shellcheck` runs over `./scripts` with `--enable=check-unassigned-uppercase`, and every caller-provided global in the extracted libraries (9 in `language-checks.sh`, 6 in `self-fix-github.sh`) is now "referenced but not assigned" — the assignments stayed behind in the entrypoints. `main`'s scan is green, so this was introduced by the split and is invisible to the gate's own `shellcheck --severity=warning` run. | CI job 119948291656: 14 SC2154 warnings, all in the two new files. Reproduced locally with the workflow's exact `SHELLCHECK_OPTS`. | Each library declares its inputs with the entrypoint's own defaults, following the `lint_cache.sh` precedent (`REPO_ROOT="${REPO_ROOT:-…}"`) — no suppressions and no workflow changes. Verified with the workflow's options: `shellcheck scripts/lib/*.sh` → 0 findings. |

## Verification

- `tests/self-fix-loop.bats`: 16 tests passed.
- Full BATS suite (`bats tests/`): 177 tests, 0 failures.
- Every assertion added for F1–F7 was observed failing with the defect
  re-injected, then passing once restored.
- `pnpm exec vitest run src/lib/__tests__/workflows.test.ts`: 63 tests passed.
- `bash -n` and ShellCheck passed for the changed shell entrypoints and libraries.
- `scripts/self-fix-loop.sh --help` exited successfully.
- `./scripts/quality_gate.sh` passed: lint, both typechecks, Vitest, BATS,
  ShellCheck, Markdownlint, and repository validators.
