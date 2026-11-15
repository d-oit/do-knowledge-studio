## LESSON-025: yamllint lints block scalars and templates

**Issue**: `YAML Syntax Validation` CI failed on workflow changes that
parsed as valid YAML (PR #640/#641).

**Root Cause**: yamllint applies `line-length` (120 max) and
`new-line-at-end-of-file` rules **inside `run: |` block scalars** and
across `.github/workflow-templates/` files, not just top-level structure.

**Solution**:

- Break long `run:` script lines with backslash continuation; verify
  with `bash -n` on the extracted block
- Ensure trailing newline on every `.yml`/`.yaml`/`.properties.json`
  file: `[ -z "$(tail -c 1 file)" ]`
- Pre-push check: `awk 'length > 120 {print NR": "length}'` on all
  workflow files

**Tags**: #yamllint #github-actions #ci-cd #workflow #linting

---
