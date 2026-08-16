# Plan 126 — Transitive nanoid Security Remediation (2026-08-15)

Status: IMPLEMENTED — included in the Plan 124 replacement PR

## Finding

The PR sweep surfaced open Dependabot alert #61:

- Advisory: GHSA-2v37-7h3g-55p8 / CVE-2026-67213
- Severity: High
- Package: transitive `nanoid@3`
- Vulnerable range: `< 3.3.18`
- Impact: attacker-controlled zero-size custom generators can loop indefinitely

The vulnerable version was selected by the repository's existing `nanoid@3`
pnpm override (`3.3.17`) used through PostCSS and the Next/Vite toolchains.

## Remediation

- Bumped the existing `nanoid@3` override to `3.3.18`, the first patched v3
  release.
- Regenerated `pnpm-lock.yaml` with the repository's required pnpm version.
- No application code or direct runtime API usage changed.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
- `./scripts/verify-deps.sh`
- `./scripts/quality_gate.sh`

All local checks passed after the remediation. GitHub Dependabot should close
alert #61 after the patched lockfile is analyzed.

## Verification (2026-08-16)

- Dependabot alert #61 is now `fixed` after the merge of PR #692
  (`a1c0721`) and subsequent lockfile analysis.
- Repository-wide alert sweep: **0 open alerts** (53 `fixed`, 4
  `auto_dismissed`) as of 2026-08-16.
- No new alerts introduced by the remediation.

Status: COMPLETE — vulnerability remediated, alert closed.
