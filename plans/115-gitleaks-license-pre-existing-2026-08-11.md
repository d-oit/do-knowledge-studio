# Plan 115 — Gitleaks License Failure (Pre-existing Infrastructure Issue)

Date: 2026-08-11

## Issue

`Security Scan` workflow's **Secret Detection with GitLeaks** step fails on every PR:

```
🛑 missing gitleaks license. Go grab one at gitleaks.io and store it as a
GitHub Secret named GITLEAKS_LICENSE.
```

Root cause chain (from CI logs, run 31520667156):

1. `gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e` (# v3.0.0) is pinned in `.github/workflows/security-scan.yml` (line 143).
2. The action tries to look up the repo owner (`Get user [d-oit]`) to validate license-free usage.
3. That API call fails with `self-signed certificate` — the runner cannot reach `api.github.com`.
4. gitleaks then **enforces** license validation → no `GITLEAKS_LICENSE` secret is configured → hard failure.

## Verification

- `security-scan.yml` on `main` is identical to the PR branch (not introduced by any PR).
- `gh secret list` shows **no** `GITLEAKS_LICENSE` secret → pre-existing.
- This check is **not** in the required status checks (only `Codacy Static Code Analysis` is required per branch rules).

## Options

| Option | Effort | Notes |
|--------|--------|-------|
| Configure `GITLEAKS_LICENSE` repo secret | Low (needs gitleaks.io account + license) | Cleanest fix; unblocks the step |
| Pin gitleaks-action to v2.x | Low | v2 does not require a license; loses v3 features |
| Add `continue-on-error: true` to the gitleaks step | Trivial | TruffleHog fallback already exists at line 149-155; keeps scan non-blocking |

## Recommendation

Option 1 (configure the secret) is the proper fix. As an interim, Option 3 (non-blocking with the existing TruffleHog fallback) prevents the red check without losing secret scanning coverage. Requires maintainer decision — no autonomous change made here.
