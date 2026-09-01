# Plan 132: PR Review, Roast & Remediation Orchestration (GOAP)

## Goal
Orchestrate review, roast, and remediation of open GitHub pull requests (PR #733, #730, #728) and open issues (#735), ensure all recommendations on PR #733 are implemented with zero-defect quality gate verification, resolve all review comments, create GitHub issues for discovered pre-existing/optimization items, and persist learnings.

## Status Analysis
- **Open PRs**:
  - `#733` (`feat/shortcuts-filter-clear-1224215614880049132`): Clear button on shortcuts filter input.
  - `#730` (`dependabot/npm_and_yarn/framer-motion-13.1.1`): Major version bump for framer-motion (12.43.0 -> 13.1.1).
  - `#728` (`dependabot/npm_and_yarn/playwright/test-1.62.1`): Minor bump for `@playwright/test` (1.61.1 -> 1.62.1).
- **Open Issues**:
  - `#735`: `[Owlwatch] Silenced exception in is_safe_url DNS resolution`.
- **Pre-existing / Optimization Findings**:
  - `impeccable/SKILL.md` reference link format mismatch causing `validate-links.sh` failure.
  - `vitest.config.ts` uses deprecated `__dirname` instead of `import.meta.dirname`.

## GOAP Sub-Goals & Phases

### Phase 1: PR #733 Roast & Recommendation Audit
- Review PR #733 diff, UX interactions, accessibility attributes, and responsive padding.
- Roast PR #733 (playful, technical, constructive).
- Audit against `@d-oit` maintainer recommendations:
  1. Rebase onto `main` (done).
  2. Input right-padding clearance for absolute `size-9` (36px) + `right-1.5` (6px) button (`pr-11` instead of `pr-8`).
  3. Verify focus restoration doesn't fight dialog Escape closing.
  4. Expand unit tests to verify `pr-11` vs `pr-3` padding and rapid type-clear-escape interaction.

### Phase 2: Quality Gates & Push
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Push rebased and patched branch to `origin/feat/shortcuts-filter-clear-1224215614880049132`.
- Verify remote CI checks via `gh pr checks 733`.

### Phase 3: PR Review Comments & Resolution
- Post comprehensive review and response addressing all recommendation checklist items.
- Resolve any outstanding review threads via GraphQL / API.

### Phase 4: Issue Creation for Pre-existing / Optimization Items
- Create GitHub issue for `impeccable/SKILL.md` link validation format regression.
- Create GitHub issue for `vitest.config.ts` Vite native config loader deprecation (`__dirname` -> `import.meta.dirname`).

### Phase 5: Knowledge Capture (Learn Skill)
- Add new lesson in `agents-docs/LESSONS.md`.
- Add distilled note in root `AGENTS.md`.
