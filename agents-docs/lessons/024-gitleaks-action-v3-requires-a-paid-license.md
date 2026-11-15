## LESSON-024: gitleaks-action v3 requires a paid license

**Issue**: `Security Scan` workflow failed on every PR with
`🛑 missing gitleaks license` (Plan 115). gitleaks-action v3.0.0 enforced
license validation when its owner-lookup API call failed (self-signed
certificate error reaching api.github.com), and no `GITLEAKS_LICENSE`
secret was configured.

**Root Cause**: gitleaks-action v3+ requires a paid `GITLEAKS_LICENSE`
secret; v2.x runs license-free for individual users. The failing license
gate also **masked real scan results** — the old allowlist was never
exercised because the scan never ran.

**Solution**:

- Pinned `gitleaks/gitleaks-action` to v2.3.9
  (`ff98106e4c7b2bc287b24eaf42907196329070c7`) — log confirms
  `No license key is required.`
- After unblocking, re-ran the scan → surfaced **8 false positives**
  (test fixtures, historical test files, doc examples) → extended
  `.gitleaks.toml` allowlist (`test[_-]?api[_-]?key`, `sk-abc123xyz`,
  `BEGIN RSA PRIVATE KEY`, path patterns)
- `workflow_dispatch` scans full git history (`fetch-depth: 0`), so
  deleted files still surface — allowlist by path pattern

**Tags**: #gitleaks #secret-detection #ci-cd #license #allowlist

---
