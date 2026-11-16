---
name: git-github-workflow
description: "Retired alias of github-workflow. Use github-workflow for the full commit to PR to CI to merge flow."
---

# Git-GitHub Workflow (retired alias)

This skill was retired in Plan 214 (#1151): `github-workflow` is the single
entry skill for the commit → PR → CI → merge lifecycle. Load
`github-workflow` instead; `atomic-commit` and `self-fix-loop` remain as its
sub-procedures.

Merge rules live in exactly one place: `agents-docs/GIT-WORKFLOW.md`.
