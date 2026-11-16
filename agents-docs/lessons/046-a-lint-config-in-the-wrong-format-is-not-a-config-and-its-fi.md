### LESSON-046: A lint config in the wrong format is not a config — and its `--fix` can rewrite prose into headings

**Symptom**: markdownlint reported thousands of findings on a repository that had
a config file, and the quality gate never reported any of them.

**Cause**: the rules sat under a `[tool.markdownlint]` table — a convention from
Python tooling that markdownlint-cli does not read — so every rule ran at its
default and the two the file meant to disable never applied. The comments also
named the wrong rule ids (`MD041` described as line length, etc.). **Unknown rule
ids are accepted silently** (verified: a config naming `MD999` exits 0), so a typo
or a wrong id produces a check that looks installed and enforces something else.

**The hazard worth remembering**: `MD018` reads a wrapped prose line that begins
with an issue reference (`#865, #870, …`) as a heading missing a space and
`--fix` "repairs" it to `# 865` — which *is* an ATX heading, so the sentence
becomes a real `<h1>`. One pass did that to 43 lines across 58 files. Per
CommonMark the original line was an ordinary paragraph; the linter rewrote a
document's structure, silently.

**Verify a lint config by execution, not by reading it**: confirm every rule id
exists in the *pinned* version's own rule list (markdownlint-cli@0.48.0 bundles
markdownlint 0.40.0), inject one violation per enforced rule and watch it fail,
and count heading lines before/after any `--fix` pass (621 → 621 here, with zero
added heading-shaped lines per file).

**Tags**: #lint #docs #tooling #verification

---
