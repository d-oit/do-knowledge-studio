# Workflow Reference

> Detailed workflow procedures referenced by AGENTS.md.
> Keep procedures here, not in AGENTS.md, to stay within `MAX_LINES_AGENTS_MD=250`
> (enforced by `scripts/agent-surface.py validate`).
>
> For the end-to-end stage loop (production → reproduce → evaluate → adversarial
> → shadow → canary → promote/rollback), see `agents-docs/DELIVERY-LIFECYCLE.md`.

## Pre-Existing Issue Resolution

**Fix ALL pre-existing issues before completing any task:**

- [ ] Lint warnings (shellcheck, markdownlint, eslint)
- [ ] Build warnings (deprecation notices, lockfile conflicts, turbopack warnings)
- [ ] Test failures
- [ ] Security vulnerabilities
- [ ] Documentation gaps (broken links, missing files)
- [ ] Code style violations

**Process:**

1. Run quality gate: `./scripts/quality_gate.sh`
2. Note all failures AND warnings (even unrelated to your changes)
3. Fix ALL issues — treat warnings as errors
4. Re-run quality gate to confirm zero failures and zero warnings

## Atomic Commit Workflow

The atomic commit pattern validates, commits, pushes, creates PR, verifies CI, and runs code review.

```bash
# Create feature branch
git checkout -b feat/your-feature-name

# Make changes

# Run atomic commit (validates, commits, pushes, creates PR, verifies, reviews)
.agents/skills/atomic-commit/run.sh

# If checks fail, fix and retry
```

The workflow includes a mandatory code review phase after CI passes:
1. `code-review-assistant` skill analyzes the PR diff
2. All P1/P2 findings must be addressed before merge
3. Re-review after fixes until clean

See `.opencode/commands/atomic-commit.md` for the full command specification.

## Post-Task Learning

After non-trivial work, capture non-obvious discoveries:

1. **Run the `learn` skill** if available, or manually append to the nearest relevant `AGENTS.md`
2. **Capture only**: hidden file relationships, surprising execution behavior, undocumented commands, fragile config, files that must change together
3. **Never write**: obvious facts, duplicates, verbose explanations, session-specific notes
4. **Scoping**: project-wide → root `AGENTS.md`; script-specific → `agents-docs/LESSONS.md`; skill-specific → `.agents/skills/<name>/references/`

This ensures the template self-improves over time as projects evolve. See `agents-docs/LESSONS.md` for the verbose historical record.

## Quality Gate Usage

```bash
# Full quality gate
./scripts/quality_gate.sh

# Fast mode skips test runners; scope and changed-file options are available
./scripts/quality_gate.sh --fast
./scripts/quality_gate.sh --scope docs
./scripts/quality_gate.sh --changed

# Minimal gate: lint, typecheck, and tests
./scripts/minimal_quality_gate.sh
```

## PR Regression Guards

`ci-and-labels.yml` runs the stale-base check on every pull request. Its
dependency-range check runs when `package.json` or `pnpm-lock.yaml` changes.

- `check-dependency-downgrades.mjs <base-ref>` compares the lowest versions
  allowed by changed ranges in `dependencies` and `devDependencies`. A lower
  minimum or a range the SemVer parser cannot compare fails closed for review.
- `check-stale-base-deletions.mjs <base-ref>` fails when the PR head is missing a
  file added to the current target branch after the merge base. Update or rebase
  the branch onto the target branch before retrying.

## Dependabot PRs

Dependabot and Jules pull requests labeled `automerge` are approved and set to GitHub auto-merge by `.github/workflows/dependabot-auto-merge.yml`. GitHub merges them after required checks pass; do not manually merge or close these opt-in pull requests.

## Swarm Web Research Workflow

For complex analysis tasks requiring parallel web research, use the
`web-search-researcher` skill for search strategy and synthesis, the
`do-web-doc-resolver` skill for URL/document resolution, and the
`agent-coordination` skill to run multiple agents in parallel. See
`.opencode/commands/swarm-web-research.md` for the command reference.
