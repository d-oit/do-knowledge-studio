# Draft Release Notes — v0.1.1

**Date**: 2026-08-12
**Status**: RELEASED — v0.1.1

## Highlights

### CI/CD Hardening
- **Merge-State Diagnoser**: Automated workflow that diagnoses blocked PRs and posts actionable comments (PR #653)
- **BATS Test Suite**: Comprehensive shell script testing with 58+ tests covering setup-skills, install-hooks, validate-skills, self-fix-loop, diagnose-merge-state, and more
- **Security Scan Template**: Reusable workflow template for shellcheck, secret detection, and Trivy scans
- **Gitleaks Pinned**: Fixed to v2.3.9 to remove paid license requirement
- **Commitlint Enforcement**: Automated commit message validation

### Performance
- **BM25 Search Cache**: ~84% query-time reduction with intelligent invalidation (PR #647)
- **Cache Memory Bounds**: Entry cap and reset on store import/reset to prevent memory leaks

### Quality
- **DeepSource Fixes**: Resolved JS-0067/JS-R1005 trap with arrow-function conventions
- **Shell Script Quality**: ShellCheck CI parity, yamllint parity, BATS coverage for all scripts
- **Codacy Compliance**: 0 issues across all PRs

### Bug Fixes
- **SSRF Protection**: Comprehensive URL validation blocking private networks, localhost, and dangerous schemes
- **Commit Bypass Prevention**: Automated commits now properly trigger commit-msg hook

## Commits (since v0.1.0)

- test(ci): add BATS tests for validate-skills and self-fix-loop; expanded coverage matrix (#663)
- test(ci): add BATS tests for setup-skills and install-hooks; script coverage matrix (#662)
- ci: add BATS-coverage pairing guard for new scripts; inline-comment SHA tests (#661)
- test(ci): cover SHA-pin validator with BATS; fix placeholder regex; yamllint parity guard; lib README (#660)
- test(ci): add shellcheck CI-parity check, verify.sh e2e gate tests, tests README (#659)
- test(ci): hard-gate BATS suite in CI; extract run_check lib; add bats lint (#658)
- test(ci): extract reusable mocked-gh BATS helper; cover unstable + rules fallback (#657)
- test(ci): add committed BATS regression suite for merge-state diagnoser (#656)
- ci: extract diagnoser logic to shared script; add yamllint CI parity check (#654)
- ci: add BLOCKED-PR diagnoser workflow; record LESSON-028 (#653)
- docs(adr): document BM25 cache; reset cache on store import/reset (#652)
- perf(search): add cache reset + entry cap to bound memory (#651)
- test(search): assert cache beats cold rebuild; record sweep summary (#650)
- test(store): verify sendMessage uses BM25 reference cache correctly (#649)
- docs: record DeepSource JS-0067/JS-R1005 trap lesson (LESSON-027) (#648)
- Cache BM25 search index and entity map build (#647)
- docs: record CI/CD learnings in plans and lessons (#646)
- fix(ci): allowlist test fixtures and doc examples in gitleaks config (#645)
- feat(ci): add security-scan workflow template (#644)
- fix(ci): pin gitleaks-action to v2.3.9 to remove license requirement (#643)

## Version Note

Old Vite-era tags v0.2.4/v0.2.5 (June 2026) predate the Next.js rewrite and had no
GitHub releases. Per maintainer decision, this release keeps the current 0.1.x line
and is tagged v0.1.1.

## Breaking Changes

None.

## Upgrade Notes

No migration required. This is a drop-in upgrade from v0.1.0.

## Metrics

- **Tests**: 2,210 passing (147 suites)
- **CI Checks**: 22/22 green
- **Coverage**: 57% lines / 50% branches / 45% functions
- **Codacy**: 0 issues
