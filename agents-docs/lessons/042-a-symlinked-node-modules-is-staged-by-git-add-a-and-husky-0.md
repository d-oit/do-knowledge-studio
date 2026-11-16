### LESSON-042: A symlinked `node_modules` is staged by `git add -A`, and `HUSKY=0` does not bypass `.githooks`

**Date**: 2026-10-12
**Component**: Git / worktrees / hooks
**Severity**: Medium

**Issue**: A PR branch shipped a `node_modules` symlink (mode `120000`) in its
commit. It was caught only when a force-push was already being prepared, and
the same blanket stage habit was about to run in eight more worktrees.

**Symptoms**:
- `git ls-tree -r --name-only <branch> | grep '^node_modules$'` returns a hit
- The file is a symlink to the main checkout, not a directory
- `git status` in the worktree shows `?? node_modules` even though `.gitignore`
  is unchanged

**Root cause**: `.gitignore` contained only `node_modules/`. A **trailing slash
makes the pattern directory-only**, and a symlink is not a directory — so the
ignore rule never matched the one shape a worktree actually produces.

Two related traps in the same session:

- `HUSKY=0` does **not** skip this repo's hooks: it installs `core.hooksPath`
  to `.githooks`, and Husky's bypass env var is unrelated. Every commit runs
  `scripts/minimal_quality_gate.sh` (~3 minutes) whether or not `HUSKY=0` is
  set; the only real bypass is `git -c core.hooksPath=/dev/null commit`.
- A `git add -A` in such a worktree stages the symlink *and* any build output
  the same way.

**Prevention**:
- Keep both forms in `.gitignore`: `node_modules/` **and** `node_modules`.
- In worktrees, prefer `git add -u` plus explicit paths over `git add -A`.
- After a commit in a worktree, `git ls-tree -r --name-only HEAD | grep -c
  '^node_modules$'` must be `0`.
- Do not use `HUSKY=0` expecting speed; if the gate must be skipped for a
  docs-only commit, say so and use `-c core.hooksPath=/dev/null`, then rely on
  CI for verification.

**Tags**: #git #worktree #gitignore #hooks #hygiene

---
