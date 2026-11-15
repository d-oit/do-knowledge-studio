### LESSON-011: CI Reliability - Why Validation Scripts Need `set +e`

**Date**: 2026-04-05
**Component**: CI/CD / Bash Scripts / Quality Gate
**Severity**: Medium

**Issue**: Validation scripts (like `validate-skills.sh`) exit prematurely on the first minor failure, preventing a full report of all issues.

**Symptoms**:
- CI job stops after the first failing skill check
- Developers have to fix one error at a time (whack-a-mole)
- Incomplete validation state in CI logs

**Root Cause**:
1. **Global `set -e`**: Scripts used `set -e` which causes immediate exit on any non-zero return code
2. **Incompatible with Error Accumulation**: Manual error tracking (e.g., `FAILED=1`) is bypassed by `set -e` if a command fails inside a loop

**Solution**:
```bash
# Explicitly disable errexit to allow manual error tracking
set +e
set -uo pipefail

FAILED=0
# ... run checks ...
[[ $something_failed ]] && FAILED=1

# Exit with accumulated status at the end
exit $((FAILED))
```

**Prevention**:
- Use `set +e` in scripts designed to accumulate multiple errors
- Document why `set +e` is used to prevent well-intentioned "fixes" back to `set -e`
- Use explicit `exit` codes based on accumulated `FAILED` variables

**Files Modified**:
- `scripts/validate-skills.sh` - Changed to `set +e` with error tracking
- `scripts/validate-skill-format.sh` - Changed to `set +e`

---
