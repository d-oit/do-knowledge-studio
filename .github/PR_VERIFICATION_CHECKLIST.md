# PR Verification Checklist

> **Atomic Commit Command Reference**  
> For use with `gh atomic-commit` or manual PR verification.  
> All items must be checked ✓ before merge. No exceptions.

---

## Quick Verification Commands

```bash
# 1. Check PR status and all CI checks
gh pr checks <pr-number>

# 2. Run local quality gate (must pass)
./scripts/quality_gate.sh

# 3. View PR diff summary
gh pr diff <pr-number> --stat

# 4. List changed files
gh pr diff <pr-number> --name-only
```

---

## Complete Verification Checklist

### 1. GitHub Actions Workflows

**All workflows must pass without warnings.**

| Workflow | Status | Command |
|----------|--------|---------|
| CI + Labels Setup | ⬜ Pass | `gh run list --workflow="CI + Labels Setup"` |
| Quality Gate | ⬜ Pass | Check quality-gate job output |
| Test Suite | ⬜ Pass | Check test job output |
| YAML Lint | ⬜ Pass | `gh run list --workflow="YAML Lint"` |
| Security Scan | ⬜ Pass | Check security job output |

**Verification Commands:**
```bash
# List recent workflow runs for this PR
gh run list --branch $(git branch --show-current) --limit 10

# Watch a specific workflow run
gh run watch <run-id>

# View failed logs
gh run view <run-id> --log-failed
```

**Blocking Rule:** Any workflow failure blocks merge immediately.

---

### 2. Lint and Formatting

**Zero warnings tolerance.** Warnings are treated as failures.

| Language | Tool | Status | Local Check |
|----------|------|--------|-------------|
| Python | ruff | ⬜ Pass | `ruff check .` |
| Python | black | ⬜ Pass | `black --check .` |
| Rust | clippy | ⬜ Pass | `cargo clippy -- -D warnings` |
| Rust | rustfmt | ⬜ Pass | `cargo fmt --check` |
| TypeScript | eslint | ⬜ Pass | `npm run lint` |
| Go | gofmt | ⬜ Pass | `gofmt -l .` |
| Go | go vet | ⬜ Pass | `go vet ./...` |
| Shell | shellcheck | ⬜ Pass | `shellcheck scripts/*.sh` |
| Markdown | markdownlint | ⬜ Pass | `markdownlint "**/*.md"` |
| YAML | yamllint | ⬜ Pass | `yamllint .github/` |

**Auto-fix Commands:**
```bash
# Python
ruff check . --fix
black .

# Rust
cargo fmt
cargo clippy --fix --allow-dirty

# TypeScript
npm run lint -- --fix

# Go
gofmt -w .

# YAML (manual fix required)
```

**Blocking Rule:** Any lint warning or formatting error blocks merge.

---

### 3. Test Verification

**All test suites must pass with no skips or pending tests.**

| Test Suite | Status | Command | Coverage |
|------------|--------|---------|----------|
| Unit Tests | ⬜ Pass | Language-specific | ⬜ Maintained |
| Integration Tests | ⬜ Pass | Language-specific | ⬜ Maintained |
| E2E Tests | ⬜ Pass/N/A | Language-specific | ⬜ N/A |
| Shell Tests (BATS) | ⬜ Pass/N/A | `bats tests/` | ⬜ N/A |

**Test Commands by Language:**
```bash
# Python
pytest tests/ -v --tb=short
pytest tests/ --cov=src --cov-report=term-missing

# Rust
cargo test --lib
cargo test --workspace

# TypeScript/JavaScript
npm test
npm run test:unit
npm run test:integration

# Go
go test ./...
go test -race ./...

# Shell
bats tests/
```

**Coverage Requirements:**
- No coverage regression from base branch
- New code must have >80% coverage
- Critical paths must have 100% coverage

**Blocking Rule:** Any test failure or coverage regression blocks merge.

---

### 4. Security Verification

**No vulnerabilities allowed at any severity.**

| Scan Type | Tool | Status | Command |
|-----------|------|--------|---------|
| Dependency Audit | depends on project | ⬜ Pass | `npm audit`, `cargo audit` |
| Secret Scan | git-secrets/trivy | ⬜ Pass | `git-secrets --scan` |
| SAST | bandit/semgrep | ⬜ Pass | `bandit -r .`, `semgrep --config=auto` |
| Container Scan | trivy | ⬜ Pass/N/A | `trivy image <image>` |

**Security Commands:**
```bash
# Python
bandit -r . -f json -o bandit-report.json || true
trivy filesystem --scanners vuln,secret,config .

# Rust
cargo audit

# Node.js
npm audit --audit-level=low

# Secrets
git-secrets --scan
```

**Blocking Rule:** Any security finding blocks merge immediately.

---

### 5. Code Review Requirements

**All required reviews must be completed with no outstanding comments.**

| Review Type | Status | Requirements |
|-------------|--------|--------------|
| Code Review | ⬜ Approved | At least 1 approval (2 for sensitive areas) |
| Security Review | ⬜ Approved/N/A | Required for auth/security changes |
| Architecture Review | ⬜ Approved/N/A | Required for large refactors |

**Review Commands:**
```bash
# View PR review status
gh pr view <number> --json reviews

# List pending reviewers
gh pr view <number> --json reviewRequests

# Check unresolved conversations
gh pr view <number> --json comments
```

**Review Thread Resolution:**
- All review comments must be resolved
- All conversations must be marked resolved
- No "will fix later" exceptions allowed

**Blocking Rule:** Missing required reviews or unresolved comments block merge.

---

### 6. Branch Protection Verification

**All branch protection rules must be satisfied.**

| Rule | Status | Verification |
|------|--------|--------------|
| Up to Date | ⬜ Yes | `git merge-base --is-ancestor origin/main HEAD` |
| Status Checks | ⬜ All Pass | `gh pr checks <number>` shows all green |
| Linear History | ⬜ Yes | No merge commits in PR branch |
| Signed Commits | ⬜ Yes/N/A | `git log --show-signature` |
| Required Reviews | ⬜ Satisfied | See section 5 |

**Branch Protection Commands:**
```bash
# Check if branch is up to date with base
git fetch origin
git merge-base --is-ancestor origin/main HEAD && echo "Up to date" || echo "Needs rebase"

# Check for merge commits
git log --merges --oneline origin/main..HEAD

# Verify linear history
git rev-list --merges --count origin/main..HEAD | grep -q "^0$" && echo "Linear" || echo "Has merges"
```

**Rebase Commands:**
```bash
# Rebase onto latest main
git fetch origin
git rebase origin/main

# Force push after rebase (if needed)
git push --force-with-lease
```

**Blocking Rule:** Any unsatisfied branch protection rule blocks merge.

---

## Blocking Error Categories

The following error categories **will block** the PR workflow:

### 🔴 Critical Blockers (Immediate)

| Category | Examples | Resolution Required |
|----------|----------|---------------------|
| **Build Failures** | Compilation errors, missing deps, broken imports | Fix before any other action |
| **Test Failures** | Assert failures, panics, timeouts | Fix and re-run tests |
| **Security Findings** | CVEs, exposed secrets, injection risks | Immediate fix + re-scan |
| **Lint Errors** | Syntax errors, undefined variables | Auto-fix or manual correction |

### 🟠 Hard Blockers (Must Fix)

| Category | Examples | Resolution Required |
|----------|----------|---------------------|
| **Lint Warnings** | Style violations, unused imports, complexity | All warnings = failures |
| **Formatting Issues** | Wrong indentation, trailing spaces | Auto-format and commit |
| **Type Errors** | TypeScript/mypy type mismatches | Fix type annotations |
| **Documentation Gaps** | Missing docstrings, README updates | Add documentation |

### 🟡 Quality Blockers (Pre-existing Issues)

| Category | Policy | Resolution |
|----------|--------|------------|
| **Pre-existing Issues** | Must fix first | Create separate PR to fix base |
| **Coverage Regression** | No decrease allowed | Add tests to cover new code |
| **New Warnings** | Zero tolerance | Fix even if base has warnings |

---

## Atomic Commit Verification

For atomic commits (single logical change per PR):

### Commit Quality Checklist

- [ ] **Single Concern**: PR addresses exactly one issue/feature
- [ ] **Conventional Format**: All commits follow `type(scope): description`
- [ ] **Clean History**: No "fix typo", "address review", "WIP" commits
- [ ] **Rebased**: Branch is rebased on latest base branch
- [ ] **Squashed**: Multiple commits squashed if they represent single logical change

### Commit Commands

```bash
# View commit history
gh pr view <number> --json commits

# Interactive rebase to clean history
git rebase -i origin/main

# Squash last N commits
git reset --soft HEAD~N
git commit -m "feat(scope): single descriptive message"

# Amend last commit
git commit --amend --no-edit
```

---

## Final Merge Verification

Before clicking merge, verify:

```bash
# Complete verification script
#!/bin/bash
set -e

PR_NUMBER=$1

echo "🔍 Verifying PR #$PR_NUMBER..."

# Check all CI passes
echo "Checking CI status..."
gh pr checks $PR_NUMBER || exit 1

# Check no conflicts
echo "Checking for conflicts..."
gh pr view $PR_NUMBER --json mergeable --jq '.mergeable' | grep -q "MERGEABLE" || exit 1

# Check reviews
echo "Checking reviews..."
gh pr view $PR_NUMBER --json reviews --jq '.reviews[] | select(.state == "APPROVED")' | grep -q . || exit 1

# Check no unresolved threads
echo "Checking review threads..."
# (Manual check required - no API for this)

echo "✅ All verifications passed!"
echo "Ready to merge with: gh pr merge $PR_NUMBER --squash --delete-branch"
```

---

## Post-Merge Verification

After merge, verify in production:

- [ ] No new errors in monitoring (24h)
- [ ] Performance metrics stable
- [ ] Feature flags working (if applicable)
- [ ] Documentation updated and visible

---

## Emergency Override

**Emergency override is only allowed for:**
- Security incident response
- Production outage fixes
- Breaking dependency updates

**Override Process:**
1. Document the emergency in PR description
2. Get 2+ senior engineer approvals
3. Create follow-up issue for any skipped checks
4. Post-incident review within 48h

---

*Last updated: 2026-04-03*  
*Enforced by: GitHub Actions + Branch Protection*
