### LESSON-013: CI Hangs Indefinitely Due to BATS Recursion

**Date**: 2026-04-04
**Component**: CI/CD / BATS Testing / Quality Gate
**Severity**: Critical

**Issue**: Quality Gate job in GitHub Actions hangs for 15+ minutes, never completes, eventually times out after 6 hours.

**Symptoms**:
- Job shows "Run quality gate" step in progress indefinitely
- No output after "Running Shell script checks..."
- Local execution completes in ~60 seconds
- Multiple workflow retries exhibit same behavior

**Root Cause**:
1. **BATS Version Incompatibility**: Ubuntu apt-get installs BATS 1.2.1 (2021), tests use `setup_file()` (requires 1.5+ from 2022)
2. **Infinite Recursion**: `quality_gate.sh` calls `bats tests/` → tests call `quality_gate.sh` → loops forever
3. **Missing Job Timeout**: No `timeout-minutes` specified, defaults to 6 hours
4. **No Recursion Guard**: Script has no mechanism to detect it's already running inside BATS

**Solution**:
```bash
# In quality_gate.sh - add recursion guard
if [ -d "tests" ] && [ "${SKIP_TESTS:-false}" != "true" ] && [ -z "${BATS_TEST_FILENAME:-}" ]; then
    # Only run BATS if not already inside a BATS test
    bats tests/
fi
```

```yaml
# In workflow - skip BATS in CI and add timeout
quality-gate:
  timeout-minutes: 10
  steps:
    - run: SKIP_TESTS=true ./scripts/quality_gate.sh
```

**Prevention**:
- Always set `timeout-minutes` on CI jobs (fail fast vs 6 hour hang)
- Check for `BATS_TEST_FILENAME` env var before invoking BATS
- Never call parent script from test files without guards
- Use `npm install -g bats` instead of apt-get for current version

**Tags**: #bats #recursion #ci-hang #timeout #testing

**Files Modified**:
- `.github/workflows/ci-and-labels.yml` - Add timeout, skip BATS
- `scripts/quality_gate.sh` - Add BATS_TEST_FILENAME check

---
