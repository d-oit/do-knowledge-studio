# PR Blocking Error Categories

> **Zero-Tolerance Policy for Merge Requirements**  
> All items below are treated as **hard blockers** - no "known issues" or "will fix later" allowed.

---

## Error Severity Matrix

| Category | Level | Auto-Detect | CI Behavior | Fix Priority |
|----------|-------|-------------|-------------|--------------|
| Build Failures | 🔴 Critical | Yes | Halt immediately | P0 - Before any other work |
| Test Failures | 🔴 Critical | Yes | Halt immediately | P0 - Before any other work |
| Security Findings | 🔴 Critical | Yes | Halt immediately | P0 - Security incident response |
| Lint/Format Errors | 🔴 Critical | Yes | Halt immediately | P0 - Auto-fix available |
| Lint/Format Warnings | 🟠 Hard Blocker | Yes | Fail build | P1 - Must fix, no exceptions |
| Type Check Failures | 🟠 Hard Blocker | Yes | Fail build | P1 - Fix type annotations |
| Coverage Regression | 🟠 Hard Blocker | Yes | Fail build | P1 - Add tests |
| Documentation Gaps | 🟠 Hard Blocker | Manual | Review block | P1 - Add docs before merge |
| Pre-existing Issues | 🟡 Quality Blocker | Yes | Special handling | P0 - Fix in separate PR first |
| Review Pending | 🟠 Hard Blocker | Yes | Merge blocked | P1 - Address all feedback |
| Conflicts | 🟠 Hard Blocker | Yes | Merge blocked | P0 - Rebase immediately |

---

## Detailed Error Categories

### 1. Build Failures 🔴

**Definition:** Any error that prevents the code from compiling, packaging, or bundling.

**Examples:**
- Compilation errors (syntax, type mismatch, missing imports)
- Dependency resolution failures
- Linker errors
- Build script failures
- Webpack/rollup bundling errors
- Docker build failures

**Detection:**
```bash
# Rust
cargo build --release || exit 1

# TypeScript
npm run build || tsc --noEmit || exit 1

# Python (syntax check)
python -m py_compile src/**/*.py || exit 1

# Go
go build ./... || exit 1
```

**CI Enforcement:**
```yaml
- name: Build
  run: cargo build --release
  # Any non-zero exit fails the workflow
```

**Policy:**
- ❌ **NO MERGE** if any build step fails
- ❌ No partial fixes (must build completely)
- ✅ Auto-detected in all CI workflows
- 🔧 Fix immediately before any other changes

---

### 2. Test Failures 🔴

**Definition:** Any test that does not pass, including unit, integration, E2E, and contract tests.

**Examples:**
- Assertion failures
- Test timeouts
- Setup/teardown failures
- Flaky tests (even if unrelated to PR)
- Segfaults/panics during tests
- Snapshot mismatches

**Detection:**
```bash
# Python
pytest tests/ -v --tb=short --strict-markers || exit 1

# Rust
cargo test --lib -- --nocapture || exit 1

# TypeScript
npm test -- --ci --coverage || exit 1

# Go
go test -race -coverprofile=coverage.out ./... || exit 1

# Shell
bats tests/ --tap || exit 1
```

**CI Enforcement:**
```yaml
- name: Tests
  run: ./scripts/run_tests.sh
  # Any test failure exits non-zero and fails workflow
```

**Policy:**
- ❌ **NO MERGE** if any test fails
- ❌ No skipping flaky tests in PR (fix the test first)
- ❌ No "expected failure" markers without documented bug
- ✅ All test failures must be investigated and fixed
- 🔧 Pre-existing failures must be fixed in separate PR

---

### 3. Lint/Format Errors & Warnings 🟠

**Definition:** Any output from linting or formatting tools, including auto-fixable issues.

**Examples:**
- Style violations (PEP8, rustfmt, gofmt)
- Unused imports/variables
- Complexity violations (cyclomatic > 10)
- Trailing whitespace
- Missing final newline
- Line too long (> 120 chars)

**Detection:**
```bash
# Python - ruff (treat warnings as errors)
ruff check . --output-format=github || exit 1

# Python - black
black --check . || exit 1

# Rust - clippy (deny warnings)
cargo clippy --all-targets -- -D warnings || exit 1

# Rust - fmt
cargo fmt --check || exit 1

# Go
gofmt -l . | grep . && exit 1
go vet ./... || exit 1

# TypeScript
npm run lint -- --max-warnings=0 || exit 1

# Shell
shellcheck scripts/*.sh || exit 1

# Markdown
markdownlint "**/*.md" --ignore node_modules || exit 1

# YAML
yamllint -d "{extends: default, rules: {line-length: {max: 120}}}" .github/ || exit 1
```

**CI Enforcement:**
```yaml
- name: Lint
  run: |
    ruff check . --output-format=github
    black --check .
  # Warnings treated as errors via -D warnings or --max-warnings=0
```

**Policy:**
- ❌ **NO MERGE** with any lint warning (warnings = failures)
- ❌ No exceptions for "minor" style issues
- ✅ Auto-fix available: `./scripts/quality_gate.sh --fix`
- 🔧 Fix all warnings, not just new ones

**Auto-Fix Command:**
```bash
# Fix all auto-fixable issues
./scripts/quality_gate.sh --fix || true

# Or individually:
ruff check . --fix
black .
cargo fmt
gofmt -w .
```

---

### 4. Security Findings 🔴

**Definition:** Any security vulnerability, exposed secret, or security anti-pattern.

**Examples:**
- CVEs in dependencies (any severity)
- Exposed API keys, passwords, tokens in code
- SQL injection vulnerabilities
- XSS vulnerabilities
- Insecure deserialization
- Weak cryptographic implementations
- Missing authentication/authorization
- Secrets committed to git

**Detection:**
```bash
# Dependency audit
cargo audit || exit 1
npm audit --audit-level=low || exit 1

# Secret scanning
git-secrets --scan || exit 1
trivy filesystem --scanners secret . || exit 1

# SAST
bandit -r . -ll || exit 1
semgrep --config=auto --error . || exit 1

# Container scanning (if applicable)
trivy image --exit-code 1 myapp:latest || exit 1
```

**CI Enforcement:**
```yaml
- name: Security Scan
  run: |
    cargo audit
    trivy filesystem --scanners vuln,secret,config --exit-code 1 .
  # Any finding exits non-zero and blocks merge
```

**Policy:**
- ❌ **NO MERGE** with any security finding
- ❌ No exceptions for "low severity" CVEs
- ❌ No "temporary" secrets (even for testing)
- 🔒 Security findings trigger incident response
- 📧 Automatic security team notification

**Secret Cleanup (if accidentally committed):**
```bash
# 1. Immediately revoke the exposed secret
# 2. Remove from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/file' \
  HEAD

# 3. Force push (coordinate with team)
git push --force-with-lease

# 4. Rotate all affected credentials
```

---

### 5. Type Check Failures 🟠

**Definition:** Any type mismatch or type system violation.

**Examples:**
- TypeScript compiler errors
- mypy type mismatches
- Rust type errors
- Go interface violations
- Python type hint errors

**Detection:**
```bash
# TypeScript
npx tsc --noEmit --strict || exit 1

# Python
mypy src/ --strict --ignore-missing-imports || exit 1

# Rust (built into cargo build, but explicit check)
cargo check || exit 1
```

**CI Enforcement:**
```yaml
- name: Type Check
  run: npx tsc --noEmit --strict
  # Any type error fails the build
```

**Policy:**
- ❌ **NO MERGE** with any type error
- ❌ No `any` types without explicit `// type-coverage:ignore-next-line`
- ❌ No `type: ignore` without documented reason
- ✅ Strict mode enabled for all type checkers

---

### 6. Coverage Regression 🟠

**Definition:** Decrease in overall code coverage or uncovered new code.

**Examples:**
- Overall coverage % decreased
- New code has < 80% coverage
- Critical path uncovered
- Previous covered lines now uncovered

**Detection:**
```bash
# Python
pytest tests/ --cov=src --cov-report=term-missing --cov-fail-under=85 || exit 1

# Rust
cargo tarpaulin --out Lcov --output-dir coverage/ || exit 1
# Compare with base branch coverage

# TypeScript
npm test -- --coverage --coverageThreshold='{"global":{"branches":85}}' || exit 1
```

**CI Enforcement:**
```yaml
- name: Coverage
  run: |
    pytest tests/ --cov=src --cov-report=xml
    # Upload to codecov or similar
    # Fail if coverage < base branch
```

**Policy:**
- ❌ **NO MERGE** with coverage regression
- ❌ No uncovered new code (exceptions require override)
- ✅ Maintain or improve overall coverage
- 📊 Coverage report attached to PR

---

### 7. Documentation Gaps 🟠

**Definition:** Missing or inadequate documentation for changes.

**Examples:**
- Public API without docstrings
- Complex algorithm without comments
- User-facing change without README update
- Breaking change without migration guide
- New dependency without justification
- Architectural decision without ADR

**Detection:**
```bash
# Check for undocumented public APIs
# (Tool depends on language)

# Check README mentions key features
grep -q "new-feature" README.md || exit 1

# Check CHANGELOG updated
grep -q "$(date +%Y-%m-%d)" CHANGELOG.md || exit 1
```

**CI Enforcement:**
```yaml
# Documentation gap detection is manual in review
# But CI can check for file existence:
- name: Check Documentation
  run: test -f docs/adr/${{ github.event.pull_request.number }}.md || true
```

**Policy:**
- ❌ **NO MERGE** with required documentation missing
- ❌ No "will document later" (document now)
- ✅ All public APIs documented
- ✅ README updated for user-facing changes
- ✅ CHANGELOG updated for notable changes

**Documentation Checklist:**
- [ ] Code comments for complex logic
- [ ] Docstrings for public functions/classes
- [ ] README updates (if user-facing)
- [ ] CHANGELOG entry (if notable)
- [ ] ADR (if architectural decision)
- [ ] Migration guide (if breaking change)

---

### 8. Pre-existing Issues 🟡

**Definition:** Issues that existed in the base branch before this PR.

**Policy:**
- ❌ **NO NEW FAILURES** - but base branch must be clean
- 🔧 If base branch has failures, fix in separate PR first
- 🔧 Rebase after base fix to get clean CI
- ✅ PR CI only fails for issues introduced by this PR

**Handling Pre-existing Issues:**
```bash
# 1. Create separate PR to fix base branch issues
git checkout -b fix/base-lint-errors
git push origin fix/base-lint-errors
# Get PR merged

# 2. Rebase your feature branch
git checkout feature/my-change
git rebase origin/main

# 3. Verify clean CI
git push --force-with-lease
```

---

### 9. Review Requirements 🟠

**Definition:** Required code reviews not yet completed.

**Requirements:**
- 1 approval for standard changes
- 2 approvals for security-sensitive changes
- All review comments resolved
- All review threads marked resolved
- No requested changes outstanding

**Policy:**
- ❌ **NO MERGE** without required approvals
- ❌ **NO MERGE** with unresolved review threads
- ❌ **NO MERGE** with "changes requested" status
- ✅ All feedback addressed or discussed

**Commands:**
```bash
# Check review status
gh pr view <number> --json reviews,reviewRequests

# Check for unresolved threads (manual via UI)
# Look for "X unresolved conversations" banner
```

---

### 10. Branch Conflicts 🟠

**Definition:** Merge conflicts with the base branch.

**Policy:**
- ❌ **NO MERGE** with conflicts
- ✅ Must rebase and resolve all conflicts
- ✅ Must verify CI still passes after rebase

**Commands:**
```bash
# Check if up to date
git fetch origin
git merge-base --is-ancestor origin/main HEAD && echo "Up to date" || echo "Needs rebase"

# Rebase
git rebase origin/main
# Resolve conflicts
git push --force-with-lease
```

---

## Integration with gh CLI

### Atomic Commit Command

```bash
# Check all blocking conditions
gh atomic-commit verify --pr=<number>

# Output:
# ✅ All workflows passing
# ✅ No lint warnings
# ✅ All tests passing
# ✅ No security findings
# ✅ Coverage maintained
# ✅ Review approved
# ✅ Branch up to date
# 
# ✓ Ready to merge: gh pr merge <number> --squash
```

### Required gh Extensions

```bash
# Install gh extensions for enhanced checks
gh extension install mislav/gh-branch
gh extension install vilmibm/gh-contrib
```

---

## Emergency Override Procedure

**Only for:**
- Security incident response
- Production outage fixes
- Breaking dependency updates with no alternative

**Override Checklist:**
- [ ] Document emergency in PR description
- [ ] 2+ senior engineer approvals (verbal okay if urgent)
- [ ] Security team sign-off (for security changes)
- [ ] Create follow-up issue for skipped checks
- [ ] Schedule post-incident review within 48h
- [ ] Document lessons learned

**Post-Incident Template:**
```markdown
## Emergency Override: PR #XXX

**Reason:** [Security incident / Outage / Dependency breakage]
**Time:** [When override granted]
**Approvers:** [Names]
**Skipped Checks:** [List]
**Follow-up Issue:** [Link]
**Post-Incident Review:** [Scheduled for YYYY-MM-DD]
```

---

## Quick Reference: Blocking vs Non-Blocking

### 🔴 Always Blocks Merge

| Issue | Detection | Fix Method |
|-------|-----------|------------|
| Build failure | CI | Fix code |
| Test failure | CI | Fix test or code |
| Security finding | CI + scan | Fix vulnerability |
| Lint error | CI | Auto-fix or manual |

### 🟠 Always Blocks Merge

| Issue | Detection | Fix Method |
|-------|-----------|------------|
| Lint warning | CI | Auto-fix |
| Type error | CI | Fix types |
| Coverage drop | CI | Add tests |
| Docs gap | Review | Add docs |
| Review pending | GitHub | Address feedback |
| Conflicts | GitHub | Rebase |

### 🟡 Context-Dependent

| Issue | Detection | Fix Method |
|-------|-----------|------------|
| Pre-existing issues | CI comparison | Fix in base first |
| Performance regression | Benchmarks | Optimize code |
| Dependency update | CI + audit | Update or pin |

---

*Enforcement: GitHub Actions + Branch Protection Rules*  
*Policy Version: 2026.04.03*  
*Zero-Tolerance: Warnings = Failures*
