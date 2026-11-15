### LESSON-002: AGENTS.md Line Limit Violation - Progressive Disclosure Principle

**Date**: 2026-04-02
**Component**: Documentation / Architecture / AGENTS.md
**Severity**: Medium

**Issue**: AGENTS.md grew to 278 lines, exceeding the 150-line target for progressive disclosure.

**Symptoms**:
- Document contains detailed workflow explanations
- Language-specific code examples duplicated from skills
- Extensive troubleshooting sections inline
- Hard to scan for essential information

**Root Cause**:
1. **Scope creep**: Added detailed content instead of references
2. **No enforcement**: Line limit documented but not checked automatically
3. **Duplication**: Content existed in both AGENTS.md and skills

**Solution**:
1. **Line Count Reduction** (278 → 146 lines):
   - Moved detailed workflows → `agents-docs/HARNESS.md`
   - Moved language examples → skill `references/` folders
   - Moved troubleshooting → individual skill docs
   - Kept in AGENTS.md: constants, overview, setup, quality gate commands, style rules, security warnings, agent guidance principles, skills table, reference links

2. **Created specialized skills**:
   - `agents-md` skill (96 lines): AGENTS.md creation guidance
   - `code-quality` skill (124 lines): Code patterns and linting tools
   - `test-runner` skill (160 lines): Framework commands and testing strategy

3. **Reference naming standardization**:
   - Standardized on `references/` (plural) across all skills
   - Migrated 13 skills from `references/` → `references/`

4. **Centralized configuration**:
   - Created `.agents/config.sh` with named constants and utility functions
   - Single source of truth for MAX_LINES_PER_SOURCE_FILE, etc.

**Prevention**:
- Add validation in `validate-skills.sh` to check AGENTS.md line count
- Document the "250-line rule" prominently in skill creation docs
- Use `@agents-docs/` references instead of inline content
- Review AGENTS.md size during PR review

**Files Modified**:
- `AGENTS.md` - Reduced from 278 to 146 lines
- `.agents/skills/agents-md/SKILL.md` - Created
- `.agents/skills/code-quality/SKILL.md` - Created
- `.agents/skills/test-runner/SKILL.md` - Created
- `.agents/config.sh` - Created with centralized constants
- 13 skills migrated: `references/` → `references/`

---
