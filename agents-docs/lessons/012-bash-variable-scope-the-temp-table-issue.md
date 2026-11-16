### LESSON-012: Bash Variable Scope - The `temp_table` Issue

**Date**: 2026-04-05
**Component**: Scripts / Bash / Variable Shadowing
**Severity**: Low

**Issue**: Using generic variable names like `temp_table` in scripts causes collisions and unexpected behavior when scripts are sourced or have complex trap logic.

**Symptoms**:
- Temporary files not being cleaned up
- `trap` removing files still in use by other parts of the script
- Data corruption in temporary markdown tables

**Root Cause**:
1. **Global Scope by Default**: Bash variables are global unless declared `local` in a function
2. **Naming Collisions**: Multiple functions or sourced scripts using the same `temp_table` name
3. **Trap Execution Context**: Traps run in the global scope and may see modified or unset variables

**Solution**:
```bash
# Define unique, descriptive names for temporary files
# Use REPO_ROOT and script-specific prefixes
readonly UPDATE_MD_TEMP_TABLE="$REPO_ROOT/.update_md_temp.md"

# Declare before trap to ensure availability
trap 'rm -f "$UPDATE_MD_TEMP_TABLE"' EXIT
```

**Prevention**:
- Use unique prefixes for temporary variables and files
- Use `readonly` where possible for configuration variables
- Define all variables used in `trap` BEFORE the trap is set

**Files Modified**:
- `scripts/update-agents-md.sh` - Refactored `temp_table` usage

---
