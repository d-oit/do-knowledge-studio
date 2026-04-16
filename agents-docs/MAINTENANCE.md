# PR Maintenance Log

This document tracks the validation and integration of external Pull Requests into the codebase.

## 2026-04-16: Batch Update

The following PRs from `d-oit/do-knowledge-studio` were validated and integrated manually:

| PR # | Title | Status | Notes |
|------|-------|--------|-------|
| 10 | Bump the npm_and_yarn group ... | Integrated | Upgraded Vite to 8.0.8 and Happy-DOM to 20.9.0. Required companion updates to `@vitejs/plugin-react` and `vitest`. |
| 7 | ci: bump actions/checkout from 4.2.2 to 6.0.2 | Integrated | Updated SHAs in `commitlint.yml`. |
| 8 | ci: bump wagoid/commitlint-github-action ... | Integrated | Updated SHA in `commitlint.yml`. |
| 6 | ci: bump reviewdog/action-actionlint ... | Integrated | Updated SHA in `yaml-lint.yml`. |
| 5 | ci: bump actions/stale from 9.0.0 to 10.2.0 | Integrated | Updated SHA and version in `stale.yml`. |
| 4 | ci: bump trufflesecurity/trufflehog ... | Integrated | Updated SHA and version in `security-scan.yml`. |
| 3 | ci: bump shellcheck-py from v0.10.0.1 to 0.11.0.1 | Integrated | Updated `.pre-commit-config.yaml`. |
| 2 | ci: bump pre-commit-hooks from v4.5.0 to 6.0.0 | Integrated | Updated `.pre-commit-config.yaml`. |

### Actions Taken
- Manually applied changes from all listed PRs.
- Updated `@vitejs/plugin-react` to `^6.0.1` and `vitest` to `^4.1.4` to resolve peer dependency conflicts with Vite 8.
- Verified all changes with `npm test`, `npm run lint`, and `npm run typecheck`.

### Recommendation
Close all the above PRs (2-8, 10) as they have been manually consolidated into the current branch to ensure compatibility and atomic verification.

## Learnings
- **Vite 8 Upgrade**: Upgrading Vite to major version 8 requires checking compatibility of companion plugins like `@vitejs/plugin-react` and the test runner `vitest`. Peer dependency warnings should be resolved by moving to the latest stable versions of these dependencies.
- **SHA-based Workflows**: Many workflows use commit SHAs for security. When updating these via Dependabot PRs, ensure both the SHA and the trailing version comment are updated for clarity.
