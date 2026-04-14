# Version Management

> Single source of truth: `VERSION` file at project root.

## Overview

Version propagation is fully automated. You only edit the `VERSION` file — everything else updates automatically.

## How It Works

```
VERSION (single source)
  ├── pre-commit hook (local dev)
  │     └── scripts/propagate-version.sh
  │
  └── GitHub Actions (CI)
        └── .github/workflows/version-propagation.yml
```

## Bumping Version

```bash
# Edit VERSION file only
echo "0.3.0" > VERSION

# Commit - pre-commit hook propagates automatically
git add VERSION
git commit -m "chore: bump version to 0.3.0"
```

The pre-commit hook detects the VERSION change and runs `propagate-version.sh`, which updates:
- `README.md` - version badge
- `QUICKSTART.md` - version badge
- `agents-docs/MIGRATION.md` - version badge + template version text
- `CHANGELOG.md` - adds `[Unreleased]` section if missing

## Manual Propagation

```bash
./scripts/propagate-version.sh
```

## Versioned Files

| File | Pattern | Updated By |
|------|---------|------------|
| `VERSION` | `0.2.2` | Manual edit |
| `README.md` | `version-X.Y.Z` badge | propagate-version.sh |
| `QUICKSTART.md` | `version-X.Y.Z` badge | propagate-version.sh |
| `agents-docs/MIGRATION.md` | badge + `Template version:` text | propagate-version.sh |
| `CHANGELOG.md` | `[Unreleased]` section | propagate-version.sh (if missing) |

## CI Workflow

On push to `main` or `feat/**` branches that change `VERSION`:
1. `.github/workflows/version-propagation.yml` triggers
2. Runs `propagate-version.sh`
3. Commits and pushes any remaining updates

This catches cases where the pre-commit hook was skipped or failed.

## Adding New Versioned Files

If a new file needs version references:
1. Add it to `FILES_TO_UPDATE` array in `scripts/propagate-version.sh`
2. Add appropriate `sed` patterns for the file's version format
3. Update this documentation

## Lessons

- Never manually edit version strings in multiple files — always use `VERSION` + propagate
- The pre-commit hook re-stages propagated files automatically (`git add`)
- CI workflow is a safety net for missed propagations
