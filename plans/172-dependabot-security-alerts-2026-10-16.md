# Plan 172 — Dependabot security alert remediation (markdownlint chain)

**Date:** 2026-10-16  
**Status:** Done — merged in PR #977 at `02529fa`; all five alerts auto-closed from the default-branch dependency graph (verified 0 open alerts)  
**Related:** Plan 171 (queue drain), `plans/156`, `plans/159` (prior lockfile advisories), `.github/workflows/security-scan.yml`, `.github/workflows/dependabot-alert-check.yml`

## Problem

Five open Dependabot alerts, all transitive dependencies of the devDependency `markdownlint-cli@0.48.0`:

| GHSA | Package | Severity | First patched |
|---|---|---|---|
| GHSA-7w5x-hrqm-74c2 | smol-toml | high | 1.7.1 |
| GHSA-r4xh-jqrq-34v2 | smol-toml | medium | 1.9.0 |
| GHSA-253c-mchw-3w2r | markdown-it | medium | 14.3.1 |
| GHSA-6v5v-wf23-mmfq | markdown-it | medium | 14.2.0 |
| GHSA-238p-pmpm-9mq7 | katex | low | 0.18.2 |

The nightly `Dependabot Alert Check` workflow fails while any alert is open, so this is a standing red scheduled check, not cosmetic noise.

## Root cause

`markdownlint-cli@0.48.0` resolved `smol-toml@1.6.1`, `markdown-it@14.1.1`, and (via `markdownlint` → `micromark-extension-math@3.1.0` → `katex@^0.16.0`) `katex@0.16.47` — all below their patched versions. Upstream 0.49.1 widens `markdown-it` to `~14.3.0` (resolves 14.3.3) and `smol-toml` to `~1.7.0` (resolves 1.7.2, clearing the high but not the ≥1.9.0 medium), and still pins `katex ^0.16.0`.

## Fix

1. `markdownlint-cli` 0.48.0 → 0.49.1 (devDependency).
2. `pnpm.overrides` additions (matching the existing override style in `package.json`):
   - `"smol-toml": "^1.9.1"` — same-major bump; smol-toml is used by the CLI only to parse TOML config files.
   - `"katex": "^0.19.0"` — katex is imported exclusively by `micromark-extension-math/lib/html.js` (the optional math→HTML extension). `markdownlint` imports only the `math` syntax factory (`lib/micromark-parse.mjs`), so the katex module is never loaded at lint time; the override is runtime-inert for this toolchain and clears the low advisory.

## Evidence

- `pnpm why` after install: `smol-toml@1.9.1`, `markdown-it@14.3.3`, `katex@0.19.0`, single version of each (verified 2026-10-16).
- Behavior: `markdownlint --config markdownlint.toml <all tracked *.md>` under 0.49.1 produced **byte-identical output** to 0.48.0 — 104 errors both, `diff` empty.
- The `Dependency Advisory Audit` gate (`pnpm audit --audit-level=high --ignore CVE-2026-93687`) passes (exit 0) after the change.
- katex load path verified by inspection: `grep katex node_modules/.pnpm/micromark-extension-math@3.1.0/.../lib/html.js` (only the html extension); `markdownlint/lib/micromark-parse.mjs:7` imports `{ math }` (syntax) only.

## Remaining advisory (documented, not actionable)

`braces` GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 (high, transitive via `eslint-config-next → fast-glob → micromatch`): **no patched release exists** (`<0.0.0`, disclosed 2026-10-03). The `dependency-audit` job already ignores this CVE until upstream ships a fix; unchanged by this plan.

## Verification plan

1. `pnpm install` with the new overrides; `pnpm why` confirms the three resolved versions.
2. markdownlint output diff against baseline — empty.
3. CI on the PR: Unit Tests, Build, E2E, Dependency Advisory Audit, Codacy.
4. After merge: confirm the five alerts auto-close from the default branch dependency graph; the nightly Open Alert Check should pass with zero alerts.

## Verification results (2026-10-16)

- PR #977 checks all green, including `Dependency Advisory Audit`, `Unit Tests`, `E2E Tests`, `Coverage Report`, and `Quality Gate`.
- Squash-merged at `02529fa`; production deployment succeeded.
- Post-merge alert poll: **0 open Dependabot alerts** — all five closed from the dependency graph. The nightly Open Alert Check now passes with nothing to fail on.
