---
name: docs-hook
description: Lightweight git hook integration for updating agents-docs with minimal tokens. Triggered on commit/merge events to sync documentation.
---

# Docs Hook

Ultra-lightweight documentation sync via git hooks.

## Trigger

- "git hook", "on commit", "pre-commit"
- "sync docs", "update docs"  
- "merge sync", "push docs"

## Usage

```bash
# After any commit that modifies .md files:
./scripts/docs-sync.sh HEAD~1 HEAD
```

Or add to `.git/hooks/post-commit`:
```bash
#!/bin/bash
./scripts/docs-sync.sh HEAD~1 HEAD
```

## Minimal Token Workflow

1. **Diff**: Get changed `.md` files between commits
2. **Sync**: Copy to target directory
3. **Done**: No ML, no logging, no metrics

## Working Script

See `scripts/docs-sync.sh` - the actual executable.