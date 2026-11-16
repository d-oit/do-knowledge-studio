### LESSON-005: GitHub Actions SKIP_TESTS - Tests Disabled in CI

**Date**: 2026-04-04
**Component**: CI/CD / Testing / GitHub Actions
**Severity**: Critical

**Issue**: CI workflow explicitly disables all testing with `SKIP_TESTS=true`.

**Symptoms**:
- Quality gate runs but skips test execution
- BATS framework not installed or executed
- Python tests skipped conditionally
- No test result reporting (JUnit/SARIF)
- Code changes not validated

**Root Cause**:
1. **Historical workaround**: Tests were failing so they were disabled
2. **No test infrastructure**: BATS not properly set up in CI
3. **Fear of blocking**: Tests might fail so CI skips them

**Solution**:
1. **Remove `SKIP_TESTS=true`** from `.github/workflows/ci-and-labels.yml`
2. **Install BATS in CI**: Add setup step for test framework
3. **Run all tests**: BATS and Python tests must pass
4. **Add coverage reporting**: Track coverage over time
5. **Fix failing tests**: Address pre-existing test failures

**Prevention**:
- Tests must pass for PR merge
- Pre-commit hooks run tests locally
- CI tests identical to local tests
- Coverage gates in CI (e.g., must maintain 80% coverage)

**Files Modified**:
- `.github/workflows/ci-and-labels.yml` - Remove SKIP_TESTS, add test execution

---
