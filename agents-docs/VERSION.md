# Version Management

> Single source of truth: `VERSION` file at project root.

## Overview

Version propagation is **manual** as of Plan 073 (2026-07-24). The `version-propagation.yml` workflow has been retired.

> **IMPORTANT: AI agents must NEVER create a GitHub release (`gh release create`) without explicit human instruction.** Releases are cut by the maintainer only. An agent may prepare draft release notes in `plans/` when asked, but must never publish a release autonomously.

## Current Workflow

1. **Maintainer only**: Edit `VERSION` file directly (the current version is `0.1.0`)
2. Run `./scripts/propagate-version.sh` locally to sync badge/version strings across files
3. Commit and push
4. **Maintainer only**: After CI passes on `main` and with explicit instruction, use `gh release create` to publish the release

## Manual Propagation

```bash
./scripts/propagate-version.sh
```

## Versioned Files

| File | Pattern | Updated By |
|------|---------|------------|
| `VERSION` | `0.1.0` | Manual edit (maintainer) |
| `README.md` | `version-X.Y.Z` badge | propagate-version.sh |
| `agents-docs/MIGRATION.md` | badge + `Template version:` text | propagate-version.sh |

## Release Workflow

GitHub releases are created **manually** after CI passes:

```bash
# After all checks pass on main
gh release create vX.Y.Z --title "Release vX.Y.Z" --notes "Release notes here"
```

## Historical Note

The `version-propagation.yml` workflow (automated VERSION-driven release) was retired in Plan 073 due to missing dependencies (`VERSION`, `CHANGELOG.md`, `scripts/propagate-version.sh` were not all present).
