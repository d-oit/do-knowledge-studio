---
description: Complete GitHub workflow - push, create branch/PR, monitor Actions with pre-existing issue detection, auto-merge/rebase when checks pass
subtask: false
---

Execute the GitHub workflow script.

Run: `./.agents/skills/github-workflow/run.sh $ARGUMENTS`

This script will:
1. Push current branch to remote
2. Create or update a PR
3. Monitor GitHub Actions
4. Detect pre-existing issues
5. Auto-merge or rebase when checks pass
