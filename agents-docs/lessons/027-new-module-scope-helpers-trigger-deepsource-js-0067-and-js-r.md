## LESSON-027: New module-scope helpers trigger DeepSource JS-0067 and JS-R1005

**Issue**: PR #647 (BM25 cache refactor) failed the `DeepSource:
JavaScript` check twice in a row. First: `search` hit cyclomatic
complexity 7 (JS-R1005, "medium" risk) after adding a cache `if/else`
inline. Second: the extracted `function getIndex()` was flagged as
JS-0067 ("Unexpected function declaration in the global scope").

**Root Cause**:

- `.deepsource.toml` issue-pattern suppressions did not prevent the
  check from failing on these findings — the code-level fix is the
  only reliable path (and AGENTS.md forbids editing suppression
  config without explicit approval).
- Top-level `function` declarations always trip JS-0067; the project
  convention is `const fn = () => {}` for module-scope helpers
  (already documented in AGENTS.md but easy to miss on new code).

**Solution**:

- Extract cache/index logic into a helper so the exported function
  stays below the complexity threshold (aim < 6).
- Use arrow-function `const` declarations for new module-scope
  helpers — never `function` declarations.
- Run the local quality gate before pushing, but expect DeepSource
  to still surface findings CI-only; plan for one fix cycle.

**Tags**: #deepsource #static-analysis #complexity #github-actions #refactor
