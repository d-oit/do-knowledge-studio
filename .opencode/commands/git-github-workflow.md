---
description: Unified atomic git workflow with GitHub integration - commits all changes, checks issues, creates PR, validates ALL Actions including pre-existing, uses swarm coordination with web research on failures
subtask: false
---

Execute the git-github workflow script with swarm coordination.

Run: `./.agents/skills/git-github-workflow/run.sh $ARGUMENTS`

This script will:
1. Commit all changes with proper message format
2. Check for existing GitHub issues
3. Create a PR
4. Validate ALL GitHub Actions pass (including pre-existing)
5. Use swarm coordination with web research on failures
6. Post-merge validation of all files and docs
