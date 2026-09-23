# Plan 147 — `quality_gate.sh --changed` Could Silently Check Nothing (2026-09-23)

**Type**: CI/tooling defect fix + regression coverage
**Scope**: `scripts/quality_gate.sh`, `tests/quality-gate-scope.bats` (new)
**Follows**: plans/146 §5, which recorded this as the reason CI missed the
`validate-skills.sh` regression

## 1. Problem

CI runs `./scripts/quality_gate.sh --changed` for the Quality Gate job. The
change-set detection could collapse to the last commit — or to nothing at all —
while still reporting success:

```bash
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
BASE_BRANCH=${BASE_BRANCH:-main}
CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH" 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo "")
if [ -z "$CHANGED_FILES" ]; then
    echo -e "${GREEN}No changes detected.${NC}"
    exit 0
fi
```

Three failure modes, all fail-open:

1. **No local base branch.** A PR checkout has no local `main`, so
   `git diff --name-only main` fails and the `HEAD~1` fallback silently reduces
   the change set to the **tip commit only**.
2. **No base at all.** If both diffs fail, `echo ""` yields an empty set and the
   gate prints `No changes detected.` and exits 0.
3. **Scope flags stay false.** The section guards are
   `SCOPE == all|tooling|agent || HAS_TOOLING || HAS_AGENT`, so a collapsed change
   set skips whole sections — including shellcheck and the BATS suite.

Evidence: PR #806 changed `scripts/validate-skills.sh` and broke three
`tests/validate-skills.bats` cases, yet its Quality Gate check completed in
**30 s** (#807: 39 s) — far below a run that includes the shell/BATS section —
and passed. The full gate failed on `main` immediately afterwards (plans/146 §1).

## 2. Fix

`resolve_base_ref()` resolves the diff base in order, first match wins:

| Order | Candidate | Why |
|---|---|---|
| 1 | `QUALITY_GATE_BASE_REF` | explicit override; what the BATS tests drive |
| 2 | `GITHUB_BASE_REF` (`origin/<ref>`, then `<ref>`) | set by GitHub Actions on `pull_request` |
| 3 | `origin/HEAD` (`origin/<branch>`, then `<branch>`) | the remote's default branch |
| 4 | `origin/main`, `main` | fallback for this repository |

The change set is then `git diff --name-only "$MERGE_BASE"` where
`MERGE_BASE=$(git merge-base "$BASE_REF" HEAD)` — so **every commit on the
branch** is checked, not just the tip. Two special cases:

- **Tip is the base** (a push to the default branch, where
  `merge-base == HEAD`): diff from `HEAD~1` instead, so the commit that landed is
  checked rather than nothing. Previously this path produced an empty diff and a
  green no-op.
- **Undeterminable base, no merge base, or a failed diff**: warn and run the
  **full gate** (`SCOPE=all`). An explicit `--scope` is still honoured.

The resolved base and the diffed commit are echoed (`Base: origin/main (diff
from 646682a)`) so the next diagnosis starts from CI logs instead of guesswork.

### Also repaired: the BATS coverage-pairing block

The "new shell scripts need `tests/<name>.bats`" check read `$BASE_BRANCH` —
the variable this plan removes. Left alone it would have compared against an
unset variable and silently stopped enforcing coverage. It now uses
`$MERGE_BASE`, which also widens it from tip-only to branch-wide.

## 3. Verification

`tests/quality-gate-scope.bats` (6 cases) runs the gate in throwaway
repositories holding a copy of the script, `scripts/lib/lint_cache.sh`, and stub
validators, so only scope detection is exercised.

| Case | Assertion |
|---|---|
| whole branch | shell section runs when an *earlier* commit touched `scripts/` and the tip is docs-only |
| tip is the default branch | the landed commit's shell change is checked |
| explicit override | `QUALITY_GATE_BASE_REF=HEAD~1` narrows to the tip |
| no base ref | prints `No base ref found`, runs `Scope: all`, never `No changes detected.` |
| coverage pairing | a branch-wide new script without `tests/<name>.bats` fails the gate |
| nothing to diff | a single-commit repository still exits 0 with `No changes detected.` |

| Check | Result |
|---|---|
| `bats tests/quality-gate-scope.bats` | 6/6 pass |
| Same tests against the pre-fix script | 5/6 fail — the suite encodes the new contract |
| `bats tests/` | 113/113 pass (107 before, 6 added) |
| `./scripts/quality_gate.sh` (scope `all`) | ✓ all gates passed |
| `--changed` on a branch | `Base: origin/main (diff from 646682a)`, shell section runs, exit 0 |
| `--changed` at the default-branch tip | diff from `646682a` (`HEAD~1`), shell section runs, exit 0 |

### Behaviour change

CI on pushes to `main` now checks what landed instead of no-oping: previously
`git diff main` was empty at the tip and the gate exited 0. Shell, BATS,
markdown and validator sections can now run on `main` pushes when the landed
commit touches their paths. That is the intent — a gate that verifies nothing is
worse than a slow one — but it is the one change in this plan that alters what
CI enforces, so it is called out here explicitly.

## 4. Follow-ups

1. **`lint_cache.sh` is skipped silently when absent** — `quality_gate.sh` only
   sources `scripts/lib/lint_cache.sh` if the file exists, leaving
   `lint_if_changed` undefined; every lint then reports as failed. Fail-closed
   (good) but the error message is misleading. Worth a clear "missing lint cache
   library" diagnostic.
2. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
3. **ESLint 10 workaround** (plans/140 §2) — blocked upstream.
