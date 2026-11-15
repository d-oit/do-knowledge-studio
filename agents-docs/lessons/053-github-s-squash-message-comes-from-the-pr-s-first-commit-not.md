### LESSON-053: GitHub's squash message comes from the PR's FIRST commit, not the final state

`gh pr merge --squash` builds the commit message from the **PR title and the
first commit's message**. A PR whose approach was reworked mid-flight — a fix
replaced by a different fix after review — lands with a message describing the
**abandoned** approach while the diff contains the new one.

Observed 2026-10-21 on PR #1012: the squash reads "drop the cached embedder
promise when a query is aborted" while the merged diff bounds the model load
instead. It cannot be repaired afterwards: correcting it needs a force-push to
`main`, which branch protection rejects (`GH013: Changes must be made through
a pull request`), and a follow-up PR cannot rewrite an existing commit's
message.

So squash locally **before** merging:

```bash
git reset --soft origin/main
git commit -m "fix(scope): the final approach"
git push --force-with-lease
gh pr edit <PR> --title "fix(scope): the final approach"
```

Two details that make or break it. The push must be a **force-push** —
squashing rewrites the commit SHAs, and without it the remote branch keeps
its original history, so `gh pr merge --squash` still uses the *remote* first
commit: the exact message this procedure exists to avoid. `--force-with-lease`
rather than `--force`, because it refuses if someone else pushed since.
Force-pushing the **PR branch** is fine; force-pushing `main` is not.

And in `git rebase -i` the **first** commit must stay `pick` — marking it
`squash` fails with `error: cannot 'squash' without a previous commit`.

**Tags**: #git #squash #history #process

---
