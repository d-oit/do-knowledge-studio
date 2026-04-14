# Pull Request Verification System

> **Comprehensive PR quality gates for atomic commits**  
> Zero-tolerance policy: All items must pass ✓ before merge.

---

## 📚 Documentation Structure

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [PULL_REQUEST_TEMPLATE.md](./PULL_REQUEST_TEMPLATE.md) | PR description template | When creating a PR |
| [PR_VERIFICATION_CHECKLIST.md](./PR_VERIFICATION_CHECKLIST.md) | Complete verification guide | When preparing to merge |
| [BLOCKING_ERROR_CATEGORIES.md](./BLOCKING_ERROR_CATEGORIES.md) | Error severity and policies | When CI fails |
| **This file** | Quick start and overview | First time here |

---

## 🚀 Quick Start

### Creating a PR

```bash
# 1. Create your feature branch
git checkout -b feat/my-feature

# 2. Make changes following [AGENTS.md](../AGENTS.md)

# 3. Run quality gate locally (must pass)
./scripts/quality_gate.sh

# 4. Commit with conventional format
git commit -m "feat(scope): add new feature"

# 5. Push and create PR
git push origin feat/my-feature
gh pr create --fill
```

### Verifying a PR (Author Checklist)

```bash
# Check PR status
gh pr view <number>

# Verify all checks pass
gh pr checks <number>

# Run local verification
./scripts/quality_gate.sh

# View diff
gh pr diff <number> --stat
```

### Merging a PR (Maintainer Checklist)

```bash
# 1. Verify all workflows green
gh pr checks <number>

# 2. Verify required reviews
gh pr view <number> --json reviews

# 3. Check no conflicts
gh pr view <number> --json mergeable

# 4. Merge with squash (recommended)
gh pr merge <number> --squash --delete-branch
```

---

## ✓ Verification Checklist (Condensed)

Before requesting review, verify:

```markdown
- [ ] Local quality gate passes: `./scripts/quality_gate.sh`
- [ ] All tests pass: `pytest`, `cargo test`, `npm test`
- [ ] No lint warnings: `ruff`, `clippy`, `eslint`
- [ ] No security findings: `bandit`, `cargo audit`
- [ ] Coverage maintained or improved
- [ ] Documentation updated (docstrings, README)
- [ ] Commits follow conventional format
- [ ] Branch is rebased on latest main
- [ ] PR template filled out completely
```

---

## 🚫 Blocking Conditions (Summary)

The following **will block merge**:

| Condition | CI Status | Required Action |
|-----------|-----------|-----------------|
| Build failure | 🔴 Failed | Fix compilation errors |
| Test failure | 🔴 Failed | Fix failing tests |
| Lint warning | 🟠 Failed | Fix all warnings |
| Security finding | 🔴 Failed | Fix vulnerability |
| Coverage regression | 🟠 Failed | Add tests |
| Missing docs | 🟠 Review block | Add documentation |
| Review pending | 🟠 Merge block | Address all feedback |
| Conflicts | 🟠 Merge block | Rebase branch |

**Zero exceptions.** All must be resolved before merge.

---

## 🛠️ gh CLI Commands Reference

### PR Lifecycle

```bash
# Create PR from current branch
git push origin HEAD
gh pr create --title "feat(scope): description" --body-file .github/PULL_REQUEST_TEMPLATE.md

# Or use web editor
gh pr create --web

# View PR status
gh pr view <number>
gh pr view <number> --web

# Check CI status
gh pr checks <number>
gh pr checks <number> --watch

# View diff
gh pr diff <number>
gh pr diff <number> --name-only
```

### Review Commands

```bash
# List open PRs
gh pr list
gh pr list --author=@me

# Review PR
gh pr review <number> --approve
gh pr review <number> --request-changes --body "See comments"

# Comment on PR
gh pr comment <number> --body "LGTM after changes"
```

### Merge Commands

```bash
# Ready to merge (after all checks pass)
gh pr merge <number> --squash --delete-branch

# Check merge status
gh pr view <number> --json mergeStateStatus,mergeable
```

---

## 🔧 Troubleshooting

### CI Fails Locally Passes

```bash
# Clean environment
git clean -fdx
./scripts/setup-skills.sh
./scripts/quality_gate.sh
```

### Lint Warnings in Base Branch

```bash
# Fix in separate PR first
git checkout -b fix/base-warnings
git push origin fix/base-warnings
# Get merged, then rebase your feature branch
```

### Test Flakiness

```bash
# Run tests multiple times
for i in {1..5}; do pytest tests/ || exit 1; done

# If flaky, fix the test - don't skip it
```

### Merge Conflicts

```bash
# Rebase workflow
git fetch origin
git rebase origin/main
# Resolve conflicts
git push --force-with-lease
```

---

## 📊 CI Workflow Overview

| Workflow | Purpose | Block on Fail |
|----------|---------|---------------|
| `CI + Labels Setup` | Label sync, skill validation | Yes |
| `Quality Gate` | Lint, format, type checks | Yes |
| `Test Suite` | Unit/integration tests | Yes |
| `YAML Lint` | Workflow validation | Yes |
| `Security Scan` | Vulnerability detection | Yes |

---

## 📝 PR Template Sections

The PR template includes:

1. **Summary** - Clear description of changes
2. **Type of Change** - Conventional commit category
3. **Testing Performed** - Test evidence and commands
4. **Pre-Merge Checklist** - All must pass ✓
5. **Blocking Conditions** - Track resolution status
6. **Impact Assessment** - Risk and scope analysis
7. **Rollback Plan** - For high-risk changes
8. **Final Confirmation** - Author attestation

---

## 🔄 Atomic Commit Policy

Each PR should represent a **single logical change**:

- One feature, fix, or refactor per PR
- Clean commit history (no "WIP", "fix typo", "address review")
- Rebased on latest base branch
- All commits follow conventional format: `type(scope): description`

### Example Good Commits:
```
feat(auth): add JWT token validation
fix(api): handle null response from downstream
refactor(db): extract connection pool to module
docs(readme): update installation instructions
```

---

## 📞 Getting Help

| Resource | Location |
|----------|----------|
| Project Guidelines | [AGENTS.md](../AGENTS.md) |
| Skill Documentation | [.agents/skills/](../.agents/skills/) |
| CI/CD Guide | [.github/workflows/](../.github/workflows/) |
| GitHub Docs | [docs.github.com](https://docs.github.com) |
| gh CLI Docs | [cli.github.com](https://cli.github.com) |

---

*This verification system ensures high-quality, consistent contributions.*  
*Questions? Open a [discussion](../../discussions) or [issue](../../issues).*
