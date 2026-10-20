# Plan 179 — Dependabot queue drain (2026-10-20)

**Date:** 2026-10-20
**Status:** Done — all five PRs merged; queue drained
**Owner:** integration owner for this sweep
**Base at inventory:** `main` `e5d6571` (after Plan 178 and the sync fixes landed)

## Scope and protocol

Drain the five open Dependabot PRs (994–998) left over after the weekly
Dependabot run. The ruleset (`main`, id 15161694) requires:

- `required_linear_history` — squash only, never a merge commit.
- `required_status_checks` with `strict_required_status_checks_policy: true` and
  `Codacy Static Code Analysis` as the only required context — every branch
  must be **up to date with `main`** before it can merge, so the queue is
  strictly serial: rebase one PR, let full CI run, squash-merge, rebase the
  next.
- `required_review_thread_resolution` — every thread resolved, outdated ones
  included.
- `code_quality` (severity `errors`) and `code_scanning` (CodeQL,
  `high_or_higher`).

The maintainer merges in parallel with this sweep (see "Parallel merges"
below), which invalidates every rebase the moment it lands.

## Inventory

| PR | Package | From → To | Files | Review notes |
|---|---|---|---|---|
| #994 | `@radix-ui/react-tooltip` | 1.2.16 → 1.4.1 | `package.json`, lockfile | minor+; `Tooltip.Provider` requirement predates this bump and the wrapper already provides it (`src/components/ui/tooltip.tsx`); 1.4.0 fixed the double-mounted `Tooltip.Content` children and the non-`Node` event-target crash |
| #995 | `@radix-ui/react-hover-card` | 1.1.23 → 1.2.1 | `package.json`, lockfile | minor; 1.2.0 allows explicit `undefined` for optional types under `exactOptionalPropertyTypes` — this repo compiles with that flag |
| #996 | `@radix-ui/react-collapsible` | 1.1.20 → 1.2.1 | `package.json`, lockfile | minor; merged first, so its `^1.2.1` became the new base for the others |
| #997 | `github/codeql-action/upload-sarif` | 4.38.3 → 4.39.0 | `.github/workflows/security-scan.yml` | action SHA pin only; v4.39.0 bumps the minimum CodeQL bundle to 2.20.7 and adds `checkout_path` validation to `analyze` — the repo has no `codeql-action/analyze` step, so that validation does not apply here |
| #998 | `@playwright/test` | 1.63.0 → 1.64.1 | `package.json`, lockfile | dev-only; 1.64 removed `Locator.ariaRef`, `exposeBinding`'s `handle`, `page.accessibility`, and the `_react`/`_vue` selectors — none are used in `e2e/` or `src/` (verified by grep) |

## Findings that changed the procedure

### The downgrade guard is a coupling between PRs, not a per-PR check

`Dependency Verify` runs `scripts/check-dependency-downgrades.mjs origin/main`,
which compares the **minimum version** of every range in the PR's
`package.json` against `main`'s. A Dependabot PR is generated against the base
it branched from, so when a sibling PR lands a bump for the *same* package
family first, the remaining PRs still carry the old range and the guard
correctly rejects them as downgrades:

```
Dependency downgrade: @radix-ui/react-collapsible ^1.2.1 -> ^1.1.20 (minimum 1.2.1 -> 1.1.20).
```

The fix is to rebase the branch so it inherits the new range — the same
`gh pr update-branch` that the strict status-check policy demands also clears
the guard. **Order matters:** merge the PR that bumps a shared package first,
then rebase the rest.

### `gh pr update-branch` cannot resolve a lockfile conflict

#995 conflicted after #994 landed: both PRs touch `pnpm-lock.yaml` and the
bot's rebase cannot merge the lockfile deltas. The conflict was resolved by
rebuilding the branch from current `main` and regenerating the lockfile with
`pnpm install --lockfile-only`, producing a delta of exactly the intended
package and nothing else.

Verified locally by text-diffing the lockfile against `main` — only the
`@radix-ui/react-hover-card` specifier, resolution and transitive
`@radix-ui/*` entries changed.

### The strict status-check policy makes `BEHIND` a hard blocker

All five PRs were `BEHIND` on arrival. With
`strict_required_status_checks_policy: true`, GitHub refuses to merge a branch
that is not the current tip of `main`, so no amount of green checks on a stale
head helps. Every PR must be rebased and re-validated after the previous one
lands.

## Parallel merges by the maintainer

The maintainer merged PRs concurrently with this sweep, which repeatedly
invalidated the rebases:

| Time (Z) | PR | Merged by | Effect on this sweep |
|---|---|---|---|
| 15:08:23 | #996 (`react-collapsible`) | `d-oit` | made #995/#998 fail the downgrade guard |
| 15:24:23 | #994 (`react-tooltip`) | `d-oit` | put #995 into a lockfile conflict (`DIRTY`) |
| — | #999, #1000 | `d-oit` | unrelated (`@huggingface/transformers`, sync signaling) |

Rebasing against a moving `main` is therefore a loop, not a step: after each
merge, re-check every remaining PR for `BEHIND`/`DIRTY` and re-sync.

## Progress

- 2026-10-20 15:0xZ: inventory — five PRs, all `BEHIND`, zero review threads
  on every PR, prior heads green except #995 (E2E `Production offline suite`
  failed with a Turbopack font-resolution error) and #995/#998 (downgrade
  guard).
- #995's first E2E failure was a `next/font/google` → `@vercel/turbopack-next`
  module-resolution error during `pnpm run build`. It was **pre-existing and
  not caused by the hover-card bump**: `main`'s own CI run
  (`39390667558`) shows the same `Production offline suite` step succeeding,
  and the failing run predates the bump. It cleared on the rebased head.
- #996 merged by the maintainer; #994 merged by the maintainer; #995 rebuilt
  from `main` with a regenerated lockfile and force-pushed (`4d222fb`);
  #997 and #998 rebased onto `main`.

## Merge ledger

| PR | Squash on main | Checks | Production |
|---|---|---|---|
| #996 | `4db17b1` | all green (merged by maintainer) | pending |
| #994 | `f25ef40` | all green (merged by maintainer) | pending |
| #997 | `7f64fac` | all green (E2E skipped: workflow-only) | n/a (workflow) |
| #995 | `5c62714` | all green incl. E2E + production offline suite | pending |
| #998 | `3ff2a61` | all green incl. E2E + production offline suite | n/a (dev-only) |

Order was forced by the dependency graph, not by the PR numbers: #997
(workflow-only) merged first to keep the queue moving while the two
package PRs waited on their lockfile rebases; #995 then landed before #998
because #998's lockfile pins `next@16.3.8(...)(@playwright/test@1.64.1)`
and must see #995's `hover-card` entry resolved first.
