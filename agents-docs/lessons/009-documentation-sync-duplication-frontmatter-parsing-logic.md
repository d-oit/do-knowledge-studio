### LESSON-009: Documentation Sync Duplication - Frontmatter Parsing Logic

**Date**: 2026-04-04
**Component**: Scripts / Documentation / DRY Principle
**Severity**: Medium

**Issue**: `update-agents-md.sh` and `update-agents-registry.sh` implement similar frontmatter parsing logic independently.

**Symptoms**:
- Code duplication between two scripts
- Same regex patterns in multiple places
- Violates DRY principle
- Maintenance burden (fix in 2+ places)

**Root Cause**:
1. **Scripts evolved separately**: No shared library concept
2. **Copy-paste development**: Similar functionality added independently
3. **No abstraction**: Missing shared utility layer

**Solution**:
1. **Create shared library** `scripts/lib/docs-utils.sh`:
   ```bash
   extract_frontmatter_field() { ... }
   generate_markdown_table() { ... }
   update_section_in_file() { ... }
   ```

2. **Refactor scripts** to use library:
   ```bash
   source "$(dirname "$0")/../scripts/lib/docs-utils.sh"
   ```

3. **Add tests** for library functions

**Prevention**:
- Check for duplication during PR review
- Create `scripts/lib/` for shared utilities
- Document library usage in AGENTS.md
- Add ShellCheck for library imports

**Files Modified**:
- `scripts/lib/docs-utils.sh` - Create shared library
- `scripts/update-agents-md.sh` - Refactor to use library
- `scripts/update-agents-registry.sh` - Refactor to use library

---

## Resources

- [BashFAQ/105 - Why set -e doesn't work](https://mywiki.wooledge.org/BashFAQ/105)
- [TLDP Exit Codes](https://tldp.org/LDP/abs/html/exitcodes.html)
- [ShellCheck Wiki](https://github.com/koalaman/shellcheck/wiki/)
- [GitHub Actions Workflow Commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions)

## Status

- ✅ LESSON-001 through LESSON-015 documented
- ✅ Root cause analysis complete
- ✅ Solutions implemented or documented
- ✅ CI verified for all recent lessons

---

**Next User Should**:
- Reference specific lesson: `@agents-docs/LESSONS.md#LESSON-001`
- Add new lessons using the template format above
- Update `lessons.jsonl` when adding lessons
- Include Date, Component, Issue, Symptoms, Root Cause, Solution, Prevention

---
