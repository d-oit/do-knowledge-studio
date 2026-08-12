# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the do-knowledge-studio project.

## Workflow Overview

- **CI** (`ci-and-labels.yml`) — Push to main/develop, PRs. Main CI
  pipeline with quality gates, tests, build, and coverage.
- **Security Scan** (`security-scan.yml`) — Push to main, PRs, weekly
  schedule. Security scanning with ShellCheck and Trivy.
- **Dependabot Auto-Merge** (`dependabot-auto-merge.yml`) — PRs from
  dependabot/jules. Auto-merge dependency updates with label requirement.
- **Commit Lint** (`commitlint.yml`) — PRs. Validates commit messages
  follow conventional commits.
- **YAML Lint** (`yaml-lint.yml`) — Push/PR. Validates YAML files.
- **Stale Issues** (`stale.yml`) — Daily schedule. Manages stale issues
  and PRs.
- **Cleanup** (`cleanup.yml`) — After PR merge. Cleans up branches and
  artifacts.
- **Labeler** (`labeler.yml`) — PRs. Auto-labels PRs based on file paths.
- **Knowledge Cleanup** (`knowledge-cleanup.yml`) — Schedule. Cleans up
  knowledge base.
- **Create Jules Issues** (`create-jules-issues.yml`) — Issues. Creates
  issues for Jules integration.
- **Dedup Issues** (`dedup-issues.yml`) — Issues. Detects and closes
  duplicate issues.
- **Sync Turso Skill** (`sync-turso-skill.yml`) — Push. Syncs Turso skill
  documentation.
- **PR Merge-State Diagnoser** (`pr-merge-state-diagnoser.yml`) — PRs.
  Posts one comment naming the real blocker on BLOCKED PRs (in-flight
  runs, failures, or staleness).

## Key Workflows

### CI Pipeline (`ci-and-labels.yml`)

The main CI pipeline runs on every push and pull request:

1. **Detect Changes** - Uses `dorny/paths-filter` to detect which files changed
2. **Quality Gate** - Runs linting, type checking, and tests on changed files
3. **Unit Tests** - Runs full test suite for regression testing
4. **E2E Tests** - Runs Playwright tests for frontend changes
5. **Build** - Verifies the project builds successfully
6. **Coverage** - Generates test coverage reports

**Concurrency**: Uses `cancel-in-progress: true` to avoid redundant runs.

### Security Scan (`security-scan.yml`)

Runs security analysis on every push to main and PRs:

- **ShellCheck** - Scans shell scripts for security vulnerabilities
- **Trivy** - Scans for secrets, misconfigurations, and vulnerabilities
- **SARIF Upload** - Results appear in GitHub Security tab

### Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

Automatically approves and enables auto-merge for dependency updates:

- **Trigger**: Only for `dependabot[bot]` or `google-labs-jules[bot]`
- **Label Requirement**: PRs must have the `automerge` label
- **Strategy**: Squash merge to keep history clean

### PR Merge-State Diagnoser (`pr-merge-state-diagnoser.yml`)

Posts one idempotent comment (marker-delimited) on BLOCKED pull requests:

- **In-flight runs**: lists check runs still `in_progress` on the head commit
- **Failures**: lists check runs that failed or timed out
- **All green**: flags GitHub merge-state staleness (see `plans/098`) and
  prints the remediation ladder

The comment is updated in place (never duplicated) and deleted once the PR
is no longer blocked.

## Best Practices

1. **Pin Actions**: All GitHub Actions are pinned to specific commit SHAs for security
2. **Timeouts**: All jobs have explicit timeouts to prevent hanging
3. **Concurrency**: Workflows use concurrency groups to avoid redundant runs
4. **Permissions**: Follow principle of least privilege
5. **Caching**: Use caching for dependencies and build artifacts

## Testing Workflows

Workflow validation tests are located in:

```text
src/lib/__tests__/workflows.test.ts
```

These tests validate:

- YAML syntax and structure
- Required fields and configurations
- Job dependencies and timeouts
- Permission settings

Run tests with:

```bash
pnpm run test -- --testPathPattern=workflows.test.ts
```

## Adding New Workflows

1. Create a new `.yml` file in this directory
2. Follow the existing naming conventions
3. Add appropriate timeouts and permissions
4. Pin all action versions to commit SHAs
5. Add validation tests in `src/lib/__tests__/workflows.test.ts`
6. Update this README with the new workflow

## Troubleshooting

### Workflow Fails to Trigger

- Check the `on:` configuration
- Verify branch names and event types
- Ensure the workflow file is on the default branch

### Auto-Merge Not Working

- Verify the PR has the `automerge` label
- Check that the actor is `dependabot[bot]` or `google-labs-jules[bot]`
- Ensure the workflow has permission to approve and merge PRs

### Security Scan False Positives

- Review the ShellCheck and Trivy output
- Suppress false positives with appropriate comments
- Update scanning configuration if needed
