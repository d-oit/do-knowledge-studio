# Plan 115 — Gitleaks License Failure (Pre-existing Infrastructure Issue)

Date: 2026-08-11 — **RESOLVED**

## Issue

`Security Scan` workflow's **Secret Detection with GitLeaks** step fails
on every PR:

```text
🛑 missing gitleaks license. Go grab one at gitleaks.io and store it as a
GitHub Secret named GITLEAKS_LICENSE.
```

Root cause chain (from CI logs, run 31520667156):

1. `gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e`
   (# v3.0.0) is pinned in `.github/workflows/security-scan.yml`
   (line 143).
2. The action tries to look up the repo owner (`Get user [d-oit]`) to
   validate license-free usage.
3. That API call fails with `self-signed certificate` — the runner
   cannot reach `api.github.com`.
4. gitleaks then **enforces** license validation → no
   `GITLEAKS_LICENSE` secret is configured → hard failure.

## Verification

- `security-scan.yml` on `main` is identical to the PR branch (not
  introduced by any PR).
- `gh secret list` shows **no** `GITLEAKS_LICENSE` secret →
  pre-existing.
- This check is **not** in the required status checks (only `Codacy
  Static Code Analysis` is required per branch rules).

## Applied Fix (maintainer decision: pin to v2)

**PR #643** — pinned `gitleaks/gitleaks-action` to `v2.3.9` (commit
`ff98106e4c7b2bc287b24eaf42907196329070c7`).

- v2.x runs without a license: log confirms `[d-oit] is an individual
  user. No license key is required.`
- TruffleHog fallback step retained for coverage.

## Follow-up: Allowlist extension (PR #645)

Pinning to v2 **enabled real scanning** for the first time, which
surfaced **8 false positives** that the old `.gitleaks.toml` allowlist
did not cover (the v3 license gate had masked them):

- `test-api-key-123456789` in `src/lib/studio/ai-settings.test.ts`
- Historical test files `src/lib/llm/__tests__/*.test.ts` (deleted from
  main but scanned via `fetch-depth: 0` full history)
- Doc examples in
  `.agents/skills/code-review-assistant/references/security-patterns.md`
  (`sk-abc123xyz`, fake RSA key)
- Empty env-var placeholder line in
  `.agents/skills/do-web-doc-resolver/SKILL.md`

`.gitleaks.toml` allowlist extended with `test[_-]?api[_-]?key` regex,
`sk-abc123xyz`, `BEGIN RSA PRIVATE KEY`, and path patterns for the
historical test dir + SKILL.md.

## Final Verification

Manual `security-scan.yml` run on `main` (run 31527596464):
**completed/success** — Shell Script Security Analysis, Secret
Detection, Trivy FS, IaC Scan, Security Scan Summary all green.

## Lesson for future

- **gitleaks-action v3+ requires a paid `GITLEAKS_LICENSE` secret.**
  Pin v2.x for license-free scanning, or configure the secret.
- A failing license gate **masks real scan results** — after any
  tooling unblock, re-run the scan to surface genuine findings and
  extend allowlists before calling it done.
- GitHub Actions `workflow_dispatch` runs scan the **full git history**
  (`fetch-depth: 0`), so deleted files with fixtures still surface as
  findings — allowlist by path pattern, not just current-tree paths.
