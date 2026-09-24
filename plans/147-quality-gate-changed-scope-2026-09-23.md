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
branch** is checked, not just the tip. Special cases:

- **Tip is the base** (a push to the default branch, where
  `merge-base == HEAD`): diff from `HEAD~1` instead, so the commit that landed is
  checked rather than nothing. Previously this path produced an empty diff and a
  green no-op.
- **Tip is the base with no parent available** (a shallow checkout, which is what
  `actions/checkout` produces by default): there is no history that says what
  landed, so the gate widens to the full gate. This case was found by verifying
  the merged fix against the real `main` push — see §3.
- **Undeterminable base, no merge base, or a failed diff**: warn and run the
  **full gate** (`SCOPE=all`). An explicit `--scope` is still honoured.

The resolved base and the diffed commit are echoed (`Base: origin/main (diff
from 646682a)`) so the next diagnosis starts from CI logs instead of guesswork.

The Quality Gate job in `.github/workflows/ci-and-labels.yml` now checks out with
`fetch-depth: 2`, so the tip-is-base case has the parent commit to diff against.
Without it the gate still widens (correct, but a full gate on every `main` push).

Two boundary notes:

- **An explicit `--scope` survives a fail-closed base resolution.** The gate
  widens to `all` only when no scope was named; `--scope frontend --changed`
  without a resolvable base still runs the frontend scope.
- **A multi-commit push to the default branch is covered only by its last
  commit.** `HEAD~1` is the base for the tip-is-base case; the exact range would
  need the push event's `before` SHA. Squash merging (`required_linear_history`)
  makes single-commit pushes the norm here, so this is recorded rather than
  built.

### Also repaired: the BATS coverage-pairing block

The "new shell scripts need `tests/<name>.bats`" check read `$BASE_BRANCH` —
the variable this plan removes. Left alone it would have compared against an
unset variable and silently stopped enforcing coverage. It now uses
`$MERGE_BASE`, which also widens it from tip-only to branch-wide.

## 3. Verification

`tests/quality-gate-scope.bats` (8 cases) runs the gate in throwaway
repositories holding a copy of the script, `scripts/lib/lint_cache.sh`, and stub
validators, so only scope detection is exercised.

| Case | Assertion |
|---|---|
| whole branch | shell section runs when an *earlier* commit touched `scripts/` and the tip is docs-only |
| tip is the default branch | the landed commit's shell change is checked |
| explicit override | `QUALITY_GATE_BASE_REF=HEAD~1` narrows to the tip |
| no base ref | prints `No base ref found`, runs `Scope: all`, never `No changes detected.` |
| explicit scope + no base ref | keeps `Scope: frontend` instead of widening to `all` |
| coverage pairing | a branch-wide new script without `tests/<name>.bats` fails the gate |
| parent-less tip | a single-commit repository widens to `Scope: all` instead of passing |
| determined empty diff | an empty commit still reports `No changes detected.` |

| Check | Result |
|---|---|
| `bats tests/quality-gate-scope.bats` | 8/8 pass |
| Same tests against the pre-fix script | 6/8 fail — the suite encodes the new contract |
| `bats tests/` | 115/115 pass (107 before, 8 added) |
| `./scripts/quality_gate.sh` (scope `all`) | ✓ all gates passed |
| `--changed` on a branch | `Base: origin/main (diff from 646682a)`, shell section runs, exit 0 |
| `--changed` at the default-branch tip, local repo | diff from `646682a` (`HEAD~1`), shell section runs, exit 0 |
| Quality Gate job on the fix PR | 2 m 34 s (was 30–39 s) — the tooling sections now run |
| Quality Gate job on `main` after merge | 29 s — `fetch-depth: 1` left no `HEAD~1`; this plan raises it to 2 |

### Behaviour change

CI on pushes to `main` now checks what landed instead of no-oping: previously
`git diff main` was empty at the tip and the gate exited 0. Shell, BATS,
markdown and validator sections can now run on `main` pushes when the landed
commit touches their paths — provided the checkout has a parent commit, which is
why the job's `fetch-depth` is raised to 2 in this plan. That is the intent — a
gate that verifies nothing is worse than a slow one — but it is the one change in
this plan that alters what CI enforces, so it is called out here explicitly.

### How the shallow-checkout case was found

The first version of this fix was merged as #809 and looked verified: 7/7 BATS
cases, the full gate green, and the fix PR's own Quality Gate job ran 2 m 34 s
instead of 30 s. The check that actually caught the gap was measuring the job on
`main` **after** the merge — 29 s, i.e. the tooling sections had not run. The
job's checkout keeps `fetch-depth: 1`, so `HEAD~1` did not exist, the
tip-is-base branch could not diff, and the gate reported `No changes detected.`
for the commit that had just landed. Local verification could not surface this
because a local clone always has history.

## 4. Follow-ups

1. **`lint_cache.sh` is skipped silently when absent** — `quality_gate.sh` only
   sources `scripts/lib/lint_cache.sh` if the file exists, leaving
   `lint_if_changed` undefined; every lint then reports as failed. Fail-closed
   (good) but the error message is misleading. Worth a clear "missing lint cache
   library" diagnostic.
   → **Fixed** in plans/151 §1: an uncached fallback plus a one-line warning, with
   a BATS suite that reproduces the false failure.
2. **DeepSource quota** (plans/141 §1) — account-level, needs the maintainer.
   → **Moot** (2026-09-24): the DeepSource GitHub app is uninstalled, so it no
   longer reports checks on this repository.
3. **ESLint 10 workaround** (plans/140 §2) — blocked upstream
   (`eslint-plugin-react@7.37.5` still caps its peer range at `^9.7`; re-checked
   against the registry 2026-09-24).
