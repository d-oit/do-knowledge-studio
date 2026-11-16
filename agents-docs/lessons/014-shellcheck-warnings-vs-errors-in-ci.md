### LESSON-014: Shellcheck Warnings vs Errors in CI

**Date**: 2026-04-04
**Component**: CI/CD / Shellcheck / Code Quality
**Severity**: Medium

**Issue**: Shellcheck fails CI build on style warnings (SC2155, SC2034), blocking merges for non-functional issues.

**Symptoms**:
- Shellcheck reports "Declare and assign separately" warnings
- Unused variable warnings (SC2034)
- CI fails even though scripts execute correctly
- 31+ warnings on large scripts like `github-workflow/run.sh`

**Root Cause**:
1. **Style vs Safety**: SC2155 is a style recommendation, not a bug
2. **Strict Default**: Shellcheck exits 1 for any warning by default
3. **Large Scripts**: Complex scripts naturally have unused variables or combined declarations
4. **CI Blocking**: Quality gate treats warnings as failures

**Solution**:
```bash
# Use --severity=error to only fail on actual problems
shellcheck --severity=error -f quiet "$script"

# Alternative: disable specific checks if needed
# shellcheck disable=SC2155,SC2034
```

**Prevention**:
- Use `--severity=error` in CI quality gates
- Reserve warnings for local development
- Document which checks are enforced in AGENTS.md
- Don't let style issues block functional code

**Tags**: #shellcheck #ci #static-analysis #warnings #quality-gate

**Files Modified**:
- `scripts/quality_gate.sh` - Add --severity=error flag

---
