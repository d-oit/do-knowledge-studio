### LESSON-040: Grep for an existing helper before adding one — duplicate escaping broke a passing BATS test

**Date**: 2026-09-28
**Component**: Build tooling / agent harness / code generators
**Severity**: Medium

**Issue**: A supposedly broken markdown table row in a generated skills catalog
was "fixed" by adding `escape_table_cell()` to `generate-skills-docs.py`. The
quality gate then failed on `escapes pipes in descriptions` — a BATS test that
had been passing all along.

**Symptoms**: Generator emitted `X \\| Y` (double-escaped) instead of `X \| Y`.
Test 4 of 9 failed; the other 8 passed.

**Root cause**: Two mistakes compounded. First, `escape_cell()` already existed
at line 149 and already handled both `|` and newlines — the grep I used to
locate it searched for the defect, not for existing helpers. Second, escaping
was applied at both `collect_skills()` (line 166) and in each renderer, so even
without my helper the value passed through `escape_cell` twice. The new helper
made a correct pipeline triple-escape.

**Prevention**:

- Before adding a helper, grep for the *name you are about to introduce* and
  for the *operation* (`replace("|"`), `escape`) across the file and repo. A
  "fix" that adds a second copy of existing logic is a smell, not a fix.
- When a test covering exactly your change already passes on `main`, stop and
  re-derive whether the bug is real. A test suite that pins behavior is
  evidence, not an obstacle to work around.
- Escaping/normalization belongs at exactly one layer. If every consumer needs
  the sanitized value, sanitize once at the boundary and pass it through.
- Run the full quality gate before committing, not the minimal one. The BATS
  suite lives in `quality_gate.sh` and found this; `minimal_quality_gate.sh`
  would have shipped a regression.
- Diff the fixed file against `HEAD` afterwards. Here `git diff` was empty —
  proof the "fix" was pure regression, and that the generated-catalog defect
  had never existed in the first place.

**Tags**: #tooling #bats #quality-gate #duplication #escaping #verification

---
