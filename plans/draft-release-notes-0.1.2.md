# Draft Release Notes — v0.1.2

**Date**: 2026-08-13
**Status**: RELEASED — v0.1.2 (published 2026-08-14)

## Highlights

### Script Tooling Restored
- **Version propagation restored**: `scripts/propagate-version.sh` brought back with full BATS coverage (PR #667) and a `propagate:version` pnpm alias (PR #668). The retired `version-propagation.yml` workflow (Plan 073) remains retired — the script is the mechanism now. Stale script references across docs remediated (#668).

### Skill Docs Sync & Warm-Cache Fix
- **Skill docs generator restored** with a resolver warm-cache CLI (PR #669); `setup-skills.sh` now regenerates the skill-docs tables (`AVAILABLE_SKILLS.md` + `README.md`) on every run, with the generator's exit code surfaced in failure warnings (PR #670)
- **Category constants synced** between `.agents/config.sh` and the docs generator (PR #670)
- **Honest warm-cache failure reporting**: semantic failures (`source==none` / `content==Failed`) now report a summary and exit 1 instead of silently passing (PR #670), guarded by 5 new BATS tests

### Merge-State Diagnostics
- **LESSON-030 documented** (PR #671): before declaring merge-state staleness or escalating to `--admin`, query `pullRequest.reviewThreads` — bot review threads are merge gates, not noise (AGENTS.md + `agents-docs/LESSONS.md` + `lessons.jsonl` + `plans/098` addendum)
- **Diagnoser names the real blocker** (PR #672): the merge-state diagnoser now queries GraphQL `reviewThreads` (`first: 100`, API-failure fallback) and reports unresolved review threads as the blocker instead of mislabeling thread-gates as staleness — 5 new BATS tests + `mock-gh` graphql branch

### Dependency Hardening
- **Vulnerable transitive deps overridden**: nanoid, js-yaml, undici, postcss (PR #666)

## Commits (since v0.1.1)

- feat(diagnoser): report unresolved review threads as the merge blocker (#672)
- docs(lessons): add LESSON-030 review-thread gate before declaring staleness (#671)
- feat(scripts): sync skill docs tables, category constants, and warm-cache failure reporting (#670)
- feat: restore skill docs generator, add resolver warm-cache CLI, fix env var docs (#669)
- docs: remediate stale script references + add propagate:version alias (#668)
- feat(scripts): restore propagate-version.sh with BATS coverage (#667)
- fix(deps): override vulnerable transitive deps (nanoid, js-yaml, undici, postcss) (#666)

## Version Note

Keeps the current 0.1.x line. Old Vite-era tags v0.2.4/v0.2.5 (June 2026) predate the
Next.js rewrite and had no GitHub releases (see the v0.1.1 draft note). The bump and
propagation are done in the release-prep PR (PR #674): `VERSION` and `package.json`
bumped to `0.1.2` (matching the v0.1.1 chore convention, #665), with
`./scripts/propagate-version.sh` syncing `agents-docs/VERSION.md` and
`agents-docs/MIGRATION.md` (README has no badge row, per plan-121). Remaining release
steps: tag `v0.1.2` and publish the GitHub release.

## Breaking Changes

None.

## Upgrade Notes

No migration required. This is a drop-in upgrade from v0.1.1.

## Metrics

- **Tests**: 2,210 passing vitest + 93 BATS (diagnoser suite 17/17)
- **CI Checks**: all green on every merged PR (Quality Gate, Unit Tests, Build, Coverage, Codacy, CodeQL, security scans, commitlint, Vercel)
- **Codacy**: 0 issues
