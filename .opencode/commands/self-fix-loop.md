---
description: Self-learning fix loop - commit, push, monitor CI, auto-fix failures using swarm agents with skills on demand, loop until all checks pass
subtask: false
---

Execute the self-fix-loop script to automate commit, push, CI monitoring, and fix cycles.

Run: `./scripts/self-fix-loop.sh $ARGUMENTS`

This script will:
1. Commit all changes
2. Push to remote
3. Create/update a PR
4. Monitor GitHub Actions
5. If checks fail, analyze failures and attempt automatic fixes
6. Retry until all checks pass or max retries reached

Available options: `--max-retries N`, `--dry-run`, `--no-fix-issues`, `--strict-validation`, `--timeout SECONDS`, `--poll-interval SECS`, `--base-branch BRANCH`
