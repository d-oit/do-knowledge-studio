---
description: Execute atomic commit workflow - validate, commit, push, create PR, and verify CI passes
subtask: false
---

Execute the atomic commit workflow script.

Run: `./scripts/atomic-commit/run.sh $ARGUMENTS`

This script will:
1. Run quality gate validation
2. Create a feature branch if on main
3. Stage and commit all changes
4. Push to remote
5. Create a PR
6. Monitor GitHub Actions until all checks pass
