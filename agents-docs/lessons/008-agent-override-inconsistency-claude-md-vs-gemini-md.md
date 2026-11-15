### LESSON-008: Agent Override Inconsistency - CLAUDE.md vs GEMINI.md

**Date**: 2026-04-04
**Component**: Documentation / Agent Overrides / CLAUDE.md
**Severity**: Medium

**Issue**: Agent-specific override files have inconsistent content depth and purpose.

**Symptoms**:
- `CLAUDE.md` has substantial content (46 lines)
- `GEMINI.md` is only `@AGENTS.md` (1 line)
- `QWEN.md` is minimal
- Override pattern is unclear
- Content duplication risk

**Root Cause**:
1. **No clear policy**: What can be overridden vs. what must stay in AGENTS.md
2. **Ad hoc additions**: Overrides added without schema
3. **No validation**: No check that overrides follow pattern

**Solution**:
1. **Define override schema** in `agents-docs/AGENT_OVERRIDES.md`:
   - Allowed: CLI-specific settings, tool preferences, timeout overrides
   - Forbidden: Duplicating AGENTS.md content, changing procedures

2. **Standardize minimal pattern**:
   ```markdown
   @AGENTS.md
   
   # Claude-Specific Settings
   - Max output tokens: 8192
   - Preferred diff format: unified
   ```

3. **Add validation**: Check that agent files only contain overrides

**Prevention**:
- Document override hierarchy
- Validate agent-specific files in CI
- Never duplicate AGENTS.md content
- Keep overrides minimal (<20 lines)

**Files Modified**:
- `CLAUDE.md` - Remove shared content, keep only overrides
- `GEMINI.md` - Already correct pattern
- `agents-docs/AGENT_OVERRIDES.md` - Create documentation

---
