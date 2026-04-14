<!--
  PR Design Agent: Comprehensive Pull Request Template
  All items must be checked ✓ before merge. No exceptions.
-->

## 📋 Summary

<!-- Provide a clear, concise summary of changes (2-3 sentences max) -->

<!-- Example: "Add user authentication flow with JWT tokens and rate limiting. Fixes session timeout issues reported in #123." -->

**Change Summary:**


**Related Issue(s):**
- Fixes #<!-- issue number -->
- Closes #<!-- issue number -->
- Related to #<!-- issue number -->

---

## 🏷️ Type of Change

**Select one (mandatory):**

- [ ] `feat:` New feature (non-breaking change adding functionality)
- [ ] `fix:` Bug fix (non-breaking change fixing an issue)
- [ ] `docs:` Documentation update only
- [ ] `style:` Code style changes (formatting, no logic changes)
- [ ] `refactor:` Code refactoring (no functional changes)
- [ ] `perf:` Performance improvements
- [ ] `test:` Adding or updating tests
- [ ] `ci:` CI/CD configuration changes
- [ ] `chore:` Build process or auxiliary tool changes
- [ ] `security:` Security-related changes

**Breaking Change?**
- [ ] No - backward compatible
- [ ] Yes - requires migration guide (see below)

<!-- If breaking change, describe the impact and migration path: -->

---

## 🧪 Testing Performed

### Automated Tests
<!-- Check all that apply. All must pass before merge. -->

- [ ] Unit tests added/updated (`pytest`, `cargo test`, `npm test`)
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] All existing tests continue to pass

**Test Commands Run:**
```bash
# Document the exact commands you ran
./scripts/quality_gate.sh
```

### Manual Testing
<!-- For UI changes, API changes, or complex logic -->

- [ ] Tested locally with realistic data
- [ ] Verified edge cases handled correctly
- [ ] Cross-browser/device testing (if UI)
- [ ] Error paths tested

**Test Evidence:**
<!-- Attach screenshots, logs, or API response samples if applicable -->

---

## ✅ Pre-Merge Checklist

### Code Quality (All Must Pass ✓)

- [ ] **Lint/Format**: No warnings or errors (`ruff`, `black`, `eslint`, `clippy`, `gofmt`)
- [ ] **Type Safety**: All type checks pass (`mypy`, `tsc`, `cargo check`)
- [ ] **Security Scan**: No vulnerabilities (`bandit`, `cargo audit`, `npm audit`)
- [ ] **Dead Code**: No unused imports, variables, or functions
- [ ] **Complexity**: No functions exceeding complexity thresholds

### Testing Requirements

- [ ] **Coverage**: No coverage regressions (maintain or improve)
- [ ] **New Code**: All new code has corresponding tests
- [ ] **Edge Cases**: Error conditions and edge cases are tested
- [ ] **Mocks**: External dependencies properly mocked/isolated

### Documentation

- [ ] **Code Comments**: Complex logic is explained with comments
- [ ] **Public APIs**: All public functions/classes have docstrings
- [ ] **README**: User-facing changes reflected in README/docs
- [ ] **Changelog**: Significant changes added to CHANGELOG.md
- [ ] **ADR**: Architectural decisions documented (if applicable)

### Review Requirements

- [ ] **Self-Review**: I have reviewed my own code first
- [ ] **Commit Quality**: Commits follow conventional commit format
- [ ] **Atomic Commits**: Each commit represents a single logical change
- [ ] **No WIP**: No "work in progress" or temporary/debug code
- [ ] **Secrets Check**: No API keys, passwords, or secrets committed

### CI/CD Verification

- [ ] **All Workflows Pass**: GitHub Actions green on this PR
- [ ] **Required Checks**: All mandatory status checks pass
- [ ] **Branch Protection**: All branch protection rules satisfied
- [ ] **No Conflicts**: Branch is rebased on latest `main`/`develop`

---

## 🚫 Blocking Conditions

**The following will block this PR from merging:**

| Category | Status | Notes |
|----------|--------|-------|
| Build Failure | ⬜ | Compilation or packaging errors |
| Test Failure | ⬜ | Any test suite failing |
| Lint Warning | ⬜ | Formatting or style issues |
| Security Finding | ⬜ | Vulnerability scan results |
| Coverage Regression | ⬜ | Code coverage decreased |
| Review Pending | ⬜ | Required reviews not obtained |
| Conflicts | ⬜ | Merge conflicts with base branch |
| Docs Gap | ⬜ | Missing or incomplete documentation |

<!-- If any checked above, PR will not be merged until resolved -->

---

## 📊 Impact Assessment

### Scope of Changes

**Files Modified:** <!-- gh pr diff --name-only -->

**Lines Changed:** <!-- gh pr diff --stat -->

### Risk Level

- [ ] **Low**: Documentation, comments, formatting
- [ ] **Medium**: Refactoring, bug fixes in isolated components
- [ ] **High**: Core functionality, security, breaking changes

### Performance Impact

- [ ] No performance impact expected
- [ ] Performance improvement
- [ ] Performance regression (document mitigation):

### Database Changes (if applicable)

- [ ] No database changes
- [ ] Schema changes (migration required)
- [ ] Data migration required

---

## 🔄 Rollback Plan

<!-- For high-risk changes, describe how to revert if issues arise -->

**Rollback Strategy:**
- [ ] Simple revert via `git revert`
- [ ] Database migration rollback script provided
- [ ] Feature flag can disable quickly
- [ ] Hotfix branch prepared

---

## 📝 Additional Notes

<!-- Any other context for reviewers -->

### Deployment Notes
<!-- Special instructions for deployment -->

### Monitoring
<!-- Metrics, alerts, or dashboards to watch post-deployment -->

### Dependencies
<!-- New dependencies or version changes -->

---

## 🎯 Reviewer Focus Areas

<!-- Help reviewers know where to focus their attention -->

- [ ] Logic correctness in `path/to/file.py`
- [ ] Security implications of authentication changes
- [ ] Performance of the new query in `models.py`
- [ ] API design and backward compatibility

---

<!--
  Post-Merge Checklist (for author to complete after merge):
  - [ ] Monitor error rates for 24h
  - [ ] Verify feature in production
  - [ ] Update monitoring dashboards if needed
  - [ ] Close related issues
-->

## 🏁 Final Confirmation

**By submitting this PR, I confirm:**

- [ ] I have read and followed the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines
- [ ] All checked items above are true and verifiable
- [ ] I understand that any unchecked item blocks merge
- [ ] I am available to address review feedback promptly
- [ ] No "known issues" or "will fix later" items remain

---

<!--
  GH CLI Commands for Reviewers:
  
  View PR details:
  gh pr view <number> --web
  
  Check PR status:
  gh pr checks <number>
  
  Review PR:
  gh pr review <number> --approve --body "LGTM"
  gh pr review <number> --request-changes --body "See comments"
  
  View diff:
  gh pr diff <number>
  gh pr diff <number> --name-only
  
  Merge when ready:
  gh pr merge <number> --squash --delete-branch
-->
