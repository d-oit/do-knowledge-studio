## LESSON-035: A `--changed` gate can silently check nothing if it guesses its own base

**Issue**: `quality_gate.sh --changed` (the CI Quality Gate job) derived its
change set with `git diff --name-only "${BASE_BRANCH:-main}" || git diff
--name-only HEAD~1 || echo ""`. A PR checkout has no local `main`, so the first
diff failed and the `HEAD~1` fallback silently reduced the change set to the
**tip commit**; when both diffs failed, the empty result was read as "nothing to
check" and the gate exited 0. PR #806 changed `scripts/validate-skills.sh` and
broke three `tests/validate-skills.bats` cases — its Quality Gate check passed in
30 s (#807: 39 s), and `main` failed the full gate minutes after the merge
(plans/146, plans/147).

**Root Cause**:

- The base ref was assumed to exist locally, and every fallback narrowed the
  input silently — no diagnostic, no widening.
- Section guards are `SCOPE == all|tooling|agent || HAS_TOOLING || HAS_AGENT`;
  a collapsed change set leaves those flags false, so whole sections
  (shellcheck, BATS, validators) never execute while the job stays green.
- The BATS coverage-pairing block read the same `$BASE_BRANCH`, so removing it
  would have silently stopped enforcing "new scripts need tests".
- A missing `scripts/lib/lint_cache.sh` leaves `lint_if_changed` undefined; every
  lint then reports as failed — fail-closed, but with a misleading message.

**Prevention**:

- Resolve the base explicitly, first match wins: `QUALITY_GATE_BASE_REF` →
  `GITHUB_BASE_REF` → `origin/HEAD` → `origin/main` → `main`; then diff from
  `git merge-base "$BASE_REF" HEAD` so the whole branch is checked.
- Treat the default-branch tip (`merge-base == HEAD`) as a push and diff from
  `HEAD~1`, so post-merge runs check what landed instead of no-oping.
- Fail closed: an undeterminable base, merge base, or diff widens the gate to
  `all` (an explicit `--scope` is preserved) and never prints
  `No changes detected.`; that message is reserved for a *determined* empty set.
- Echo the resolved base and diffed commit (`Base: origin/main (diff from
  646682a)`) so CI logs answer "what did this gate actually check?".
- `tests/quality-gate-scope.bats` pins all eight cases; six fail against the
  pre-fix script.
- **A fix that leans on git history must verify the CI checkout has that
  history.** The first version of this fix (#809) passed 7/7 local tests, a green
  full gate, and a Quality Gate job that jumped from ~30 s to 2 m 34 s on the PR.
  What exposed the gap was measuring the job on `main` *after* the merge: 29 s,
  because `actions/checkout` defaults to `fetch-depth: 1`, so `HEAD~1` did not
  exist and the "check what landed" branch could not diff. The job now checks
  out with `fetch-depth: 2`, and a tip-with-no-parent widens the gate instead of
  passing. Local verification cannot catch this class of bug: a local clone
  always has history.

**Tags**: #quality-gate #ci #git #fail-closed #bats #shallow-clone
