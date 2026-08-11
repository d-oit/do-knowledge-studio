# Plan 114 — Open PR Sweep: Review, Fix, and Merge (GOAP orchestration)

Date: 2026-08-11 — **COMPLETE: 0 open PRs remain**

## Final Outcomes

All 11 open PRs processed. **8 merged manually in this sweep (no `--auto`), 3 merged by the repo's auto-merge workflow mid-sweep, 2 merged by the maintainer.**

| PR | Change | Outcome |
|----|--------|---------|
| 624 | OKF export/import | Merged by maintainer 09:41 (pre-sweep) |
| 625 | dompurify 3.4.12→3.4.13 + override | **Fixed by me** (rebase + conflict resolution + Build flake recovery), merged manually 10:51 |
| 626 | fix(owlwatch) 620-622 | Threads resolved; `_detect_error_type` refactored (commit ccfb547, CCN 10→2); merged by maintainer 09:57 (contains refactor) |
| 629 | docs: TRIZ addendum | Merged manually 11:00 |
| 630 | pnpm/action-setup | Merged manually 10:38 |
| 631 | dorny/paths-filter | Merged manually 10:27 |
| 632 | radix checkbox | Unblocked (resolved owl-watch thread); merged manually 10:44 |
| 633 | actionlint | Merged manually 10:20 |
| 634 | radix nav-menu | Auto-merged 09:52 (repo workflow) |
| 635 | radix select | Auto-merged 09:45 (repo workflow) |
| 636 | tailwindcss/postcss | Auto-merged 09:48 (repo workflow) |
| 637 | codeql upload-sarif | Merged manually 10:12 |
| 638 | test_utils.py (NEW follow-up) | Created by me (stranded test commit from #626); merged manually 11:11 |

## Key interventions

1. **PR 625**: Build failure was a Turbopack Google-Fonts network flake, not the dep bump. Rebased + resolved package.json/pnpm-lock.yaml conflicts (kept main deps: radix-select 2.3.7, fflate, yaml + dompurify bump + transitive override). Lockfile regenerated via `pnpm install --lockfile-only`; verified 0 stale `dompurify@3.4.12` entries; local build passed.
2. **PR 626**: Branch was missing the OKF feature (#624) — merging as-is would have **reverted it**. `gh pr update-branch` fixed the tree. Refactored `_detect_error_type` to a table-driven lookup (`ERROR_TYPE_PATTERNS`); resolved 10 threads (9 stale DeepSource + 1 live owl-watch) via GraphQL.
3. **PR 632**: Unblocked by resolving an informational owl-watch "keeper" thread.
4. **PR 638**: Follow-up PR delivering `test_utils.py` (20 parametrized cases) that landed post-merge on #626.
5. **No automerge honored**: disabled GitHub auto-merge (`disablePullRequestAutoMerge`) on all remaining PRs; all 8 merges done manually with `gh pr merge --squash --delete-branch` in impact order (workflows → lockfile → docs/tests), re-syncing branches (`gh pr update-branch`) + re-running CI before every merge (strict up-to-date policy).

## Post-sweep actions

- **Workflow gated**: `.github/workflows/dependabot-auto-merge.yml` now requires an `automerge` label on the PR to enable auto-merge. Dependabot PRs will no longer auto-merge by default — must be explicitly opted in.
- **Branches cleaned**: All 5 stale local branches deleted. Only `main` remains.
- **Quality gate passed**: lint clean, typecheck clean, 2141/2142 tests pass (1 skipped), build successful.

## Roast

- 9 of 11 PRs were dependabot bumps queued like cargo at a toll booth — beige but necessary. Three of them merged *themselves* mid-sweep because the repo's own auto-merge workflow was armed and dangerous.
- PR 626 renamed itself "remediation" and still shipped a fresh CCN-16 function for the bots to snack on — then got merged by the maintainer 3 minutes before my test commit landed, leaving a stranded test orphan that needed its own PR (#638).
- PR 625 tried to merge a patch bump while Google Fonts was having a bad day in CI (Turbopack threw 12 identical errors, all the same module).
- PR 632's only blocker was an owl-watch bot telling us the checkbox version was... the latest version.
- PR 629 is a doc that mostly exists so the TRIZ matrix doesn't lie to future generations.
- The whole sweep was a CI treadmill: 7 manual merges, 7× re-sync cycles, and one existential crisis over whether a test-only PR could sneak OKF files into main (it couldn't).
