# Release Branch Task

You are preparing a release branch for this project. Follow these steps systematically.

## Phase 0 — Pre-release Checklist

1. Read `AGENTS.md` and internalize all rules.
2. Ensure you're on the latest `main` branch:
   ```bash
   git fetch origin main && git checkout main && git pull
   ```
3. Verify all CI checks pass on main:
   ```bash
   gh run list --branch main --limit 5 --json status,conclusion
   ```

## Phase 1 — Version Bump

1. Determine the new version based on semver:
   - **Major**: Breaking API changes
   - **Minor**: New features, non-breaking
   - **Patch**: Bug fixes, docs, chores
2. Update version in:
   - `package.json` (the `version` field)
   - `VERSION` file
   - `CHANGELOG.md` (add new section)
3. Commit: `git commit -m "chore: bump version to vX.Y.Z"`

## Phase 2 — Release Branch

1. Create release branch:
   ```bash
   git checkout -b release/vX.Y.Z
   ```
2. Run the full quality gate:
   ```bash
   pnpm run quality_gate
   ```
3. Build and verify the production output:
   ```bash
   pnpm run build && pnpm run preview
   ```

## Phase 3 — Push Branch

1. Push the release branch:
   ```bash
   git push -u origin release/vX.Y.Z
   ```

## Phase 4 — GitHub Release

1. Create a PR from `release/vX.Y.Z` to `main`:
   ```bash
   gh pr create --base main --title "Release vX.Y.Z" --body "$(cat CHANGELOG.md | sed -n '/## vX.Y.Z/,/## v/p' | head -n -1)"
   ```
2. After merge, verify CI passes on `main`
3. Create the release manually:
   ```bash
   gh release create vX.Y.Z --title "Release vX.Y.Z" --notes "Release notes here"
   ```

## Phase 5 — Post-release

1. Verify CI passed on main after the version bump merge:
   ```bash
   gh run list --branch main --limit 3
   ```
2. Update `plans/` with release notes.
3. Announce in relevant channels.

## Global Constraints

- **Never** skip the quality gate.
- **Never** release without passing all CI checks.
- **Always** use semantic versioning.
- **Always** tag releases with `v` prefix.
