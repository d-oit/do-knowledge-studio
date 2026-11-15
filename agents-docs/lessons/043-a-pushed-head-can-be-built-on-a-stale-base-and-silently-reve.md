### LESSON-043: A pushed head can be built on a stale base and silently revert `main` — bless it before you merge

**Date**: 2026-10-12
**Component**: Review / automation branches
**Severity**: High

**Issue**: A PR's head commit was re-pushed by an automation run whose tree had
been built from an older `main`. Relative to `main` it **deleted** a file that
had landed after the merge base (`entity-search-panel.tsx`, from #910) and
resurrected several pre-refactor files. Merging it would have reverted `main`.
It also generated nine extra review threads pointing at files that are not in
the PR at all.

**Symptoms**:
- Fourteen unresolved threads, most naming files absent from the PR's own diff
- `git diff origin/main <head> --stat` shows large deletions that the PR
  description never mentions
- `git log --oneline <head>` shows a commit whose parent is your own reviewed
  commit, yet its content disagrees with the branch

**Root cause**: The automation rebased/regenerated its tree from a stale copy of
the default branch and then pushed over the current head. Nothing in CI checks
whether a head *removes* things `main` gained after the merge base.

**Prevention**:
- Before trusting any head: `git merge-base --is-ancestor origin/main <sha>`
  must be true, **and** `git diff origin/main <sha> --stat` must contain no
  unexplained deletions.
- When it fails, do not rebase the bad commit — it has no relation to your
  reviewed work. Force-push back to the last blessed commit and say why in the
  PR thread.
- Recovery is cheap only if your fixes are **committed**. In this session
  uncommitted fixes were discarded by a `git reset --hard` while re-basing;
  commit before any rebase or reset, or the fixes are re-typed from memory.
- Findings that point at files outside the PR diff are stale-tree artifacts:
  reply with that evidence and resolve, rather than "fixing" phantom code.

**Tags**: #git #review #automation #revert #worktree #verification

---
