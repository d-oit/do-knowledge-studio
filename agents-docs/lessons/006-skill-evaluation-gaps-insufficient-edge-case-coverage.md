### LESSON-006: Skill Evaluation Gaps - Insufficient Edge Case Coverage

**Date**: 2026-04-04
**Component**: Skills / Evaluations / Coverage
**Severity**: High

**Issue**: 80% of skills (24 of 30) lack comprehensive edge case evaluations.

**Symptoms**:
- Skills with <5 evals (6 skills, 20%)
- No error handling evals (18 skills, 60%)
- No integration scenarios between skills
- Subjective assertions in evals ("feels natural", "can understand")
- No negative test cases (failure paths)

**Root Cause**:
1. **Focus on happy path**: Evals only test success scenarios
2. **No eval guidance**: AVAILABLE_SKILLS.md lacks evaluation authoring guide
3. **No quality gate**: CI doesn't validate eval coverage
4. **Manual process**: No automation for eval structure

**Solution**:
1. **Add edge case evals** to all skills:
   - parallel-execution: threshold synchronization, failure handling
   - goap-agent: dynamic replanning (only 4 evals currently)
   - testing-strategy: mutation testing (mentioned but not tested)
   - security-code-auditor: Go/Rust/Java-specific tests

2. **Standardize eval format**:
   - Remove subjective assertions
   - Add version field to all evals.json
   - Include negative test cases

3. **Create evals documentation**:
   - Add section to `agents-docs/AVAILABLE_SKILLS.md`
   - Document how to write comprehensive evals

**Prevention**:
- Minimum 5 evals per skill (goap-agent currently fails this)
- At least 1 negative test case per skill
- JSON Schema validation for evals.json
- No subjective assertions (replace with checkable patterns)

**Priority Skills to Fix**:
- skill-creator: Fix malformed JSON, add line limit eval
- parallel-execution: Add threshold sync eval
- testing-strategy: Add mutation testing eval
- security-code-auditor: Add language-specific evals

---
