### LESSON-001: Bash Exit Code 2 - Misuse of Shell Builtins in CI

**Date**: 2026-04-01
**Component**: CI/CD / Bash Scripts / Quality Gate
**Severity**: High

**Issue**: Quality Gate CI job fails with exit code 2 in GitHub Actions while passing locally.

**Symptoms**:
- `Process completed with exit code 2` in CI only
- Same script passes on developer machines
- Validate Skills job passes, Quality Gate fails
- No visible error output before exit

**Root Cause**:
1. **Exit Code 2 Meaning**: "Misuse of shell builtins" per Bash documentation - indicates empty function definitions, missing keywords, permission problems, or builtin misuse
2. **`set -e` is unreliable**: Has "extremely convoluted and version-dependent behavior" per BashFAQ/105
3. **Functions behave differently**: `set -e` is effectively ignored inside functions called in conditionals
4. **`realpath --relative-to` is GNU-specific**: Not available in minimal CI containers (Alpine, etc.)
5. **TTY/Color Detection**: `test -t 1` returns true locally, false in non-TTY CI

**Solution**:
```bash
# Don't use set -e - it's unreliable in CI
set -uo pipefail

# Use readlink -f for portability instead of realpath --relative-to
target=$(readlink -f "$link" 2>/dev/null || echo "")

# Safe color detection
if [[ -t 1 ]] && [[ "${FORCE_COLOR:-}" != "0" ]]; then
    RED='\033[0;31m'
else
    RED=''
fi

# Track failures explicitly
EXIT_CODE=0
run_check() { ... ; EXIT_CODE=1; }
exit $EXIT_CODE
```

**Prevention**:
- Test scripts in non-TTY mode: `bash script.sh | cat`
- Avoid GNU-specific options like `realpath --relative-to`
- Never rely on `set -e` for CI scripts
- Use explicit error tracking with EXIT_CODE variables
- Document CI-specific behavior in skill references

**Files Modified**:
- `scripts/validate-skills.sh` - Fixed set -e and realpath issues
- `scripts/quality_gate.sh` - Fixed set -e and color handling
- `.github/workflows/ci-and-labels.yml` - Added debug output

---
