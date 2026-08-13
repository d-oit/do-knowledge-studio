# Workflow Reference

> Detailed workflow procedures referenced by AGENTS.md.
> Keep procedures here, not in AGENTS.md, to stay within `MAX_LINES_AGENTS_MD=150`.

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
# Full quality gate (required before commit)
./scripts/quality_gate.sh

# Skip specific checks
SKIP_TESTS=true ./scripts/quality_gate.sh
SKIP_LINT=true ./scripts/quality_gate.sh
SKIP_LINKS=true ./scripts/quality_gate.sh

# Minimal quality gate (fast path for CI debugging)
./scripts/minimal_quality_gate.sh
```

## Dependabot PRs

Dependabot PRs are auto-merged via CI when all checks pass. Do not manually merge or close Dependabot PRs.

## Swarm Web Research Workflow

For complex analysis tasks requiring parallel web research, use the
`web-search-researcher` skill for search strategy and synthesis, the
`do-web-doc-resolver` skill for URL/document resolution, and the
`agent-coordination` skill to run multiple agents in parallel. See
`.opencode/commands/swarm-web-research.md` for the command reference.
