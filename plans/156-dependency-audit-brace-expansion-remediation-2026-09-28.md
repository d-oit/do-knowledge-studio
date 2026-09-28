# Plan 156 — Dependency audit remediation: `brace-expansion` (2026-09-28)

**Status**: Implemented on branch `fix/brace-expansion-audit`, submitted as a pull request
**Trigger**: `pnpm audit` reported two high-severity advisories against the single installed `brace-expansion@1.1.16`.
**Scope**: security/lockfile maintenance only — not a general outdated-dependency refresh.

## Context

The audit flagged two advisories on `brace-expansion@1.1.16`, reachable through the ESLint/Next lint
tooling chain. The existing `pnpm.overrides` selector in `package.json` was pinning
`brace-expansion@<1.1.16` to `1.1.16` — that is, the override **selected the vulnerable version
itself** and guaranteed the advisory rather than preventing it.

| Advisory | Severity | Vulnerable | Patched | CVE |
|---|---|---|---|---|
| GHSA-mh99-v99m-4gvg | high | `<1.1.17` | `>=1.1.17` | CVE-2026-14257 |
| GHSA-rgw5-rvv9-x895 | high | `<1.1.18` | `>=1.1.18` | CVE-2026-69152 |

The stricter advisory (`GHSA-rgw5-rvv9-x895`) sets the binding floor at `>=1.1.18`. The pin was below
both floors, so the fix had to move the resolved version up, not merely narrow the selector.

## Change

Two files, one logical edit:

- `package.json` — `pnpm.overrides`:
  `"brace-expansion@<1.1.16": "1.1.16"` → `"brace-expansion@<1.1.18": "1.1.21"`
- `pnpm-lock.yaml` — regenerated with `pnpm install --lockfile-only --no-frozen-lockfile`.

The selector targets only the vulnerable v1 range, so the separate `brace-expansion@5.0.9` resolution
(the `minimatch@10.2.6` / `eslint@10` branch) is untouched. `1.1.21` is the current v1 patch on the
registry and carries the `maxLength` mitigation from the v5 line of development.

Deliberately **not** changed: ESLint config, Next, Vitest, any other override, and all direct
dependencies. `pnpm outdated` lists unrelated major upgrades (Vitest, TypeScript) that must not be
bundled into a security patch.

## Verification

All commands run from the repository root.

| Check | Result |
|---|---|
| `pnpm install --lockfile-only --no-frozen-lockfile` | exit 0 |
| `pnpm install --frozen-lockfile` | exit 0, lockfile stable across re-run |
| `pnpm why brace-expansion` | `1.1.21` under `minimatch@3.1.5`; `5.0.9` under `minimatch@10.2.6` |
| `pnpm audit` | `No known vulnerabilities found`, exit 0 — 0 advisories across 889 dependencies |
| `pnpm run lint` | exit 0 |
| `pnpm run typecheck` | exit 0 |
| `pnpm run test` | 173 files, 2672 passed, 1 skipped, type errors: none |
| `pnpm run build` | exit 0 (Next.js 16.3.6, Turbopack) |
| `pnpm run test:e2e` | 600 passed, 4 skipped |
| `pnpm run test:coverage` | exit 0 (statements 86.93%) |
| `./scripts/verify-deps.sh` | ALL CHECKS PASSED, including the Vercel build gate |
| `./scripts/quality_gate.sh` | ALL Quality Gates PASSED (shellcheck + bats included) |
| `git diff --check` | clean |

**Lockfile diff scope** — exactly 4 hunks, all `brace-expansion`: the `overrides` key, the `packages`
entry, the `snapshots` entry, and the `minimatch@3.1.5` dependency edge. No unrelated locked package
moved, so no hunk restoration was required. `brace-expansion@5.0.9` retained at both entries.

**Behavioral proof** — the advisory describes an *uncatchable* out-of-memory crash, so a lockfile
rename alone would be insufficient evidence. Running the advisory's PoC shape
(`'{a,b}'.repeat(3000)`, chained brace groups) under a 256 MB heap:

- `1.1.16`: throws `RangeError` (and lacks the `maxLength` mitigation in `index.js`).
- `1.1.21`: completes; at 2× the PoC size the result count *shrinks* (1333 → 666), showing the
  length cap is actively enforced rather than merely present.

The live resolution was confirmed at the symlink level:
`node_modules/.pnpm/minimatch@3.1.5/node_modules/brace-expansion -> brace-expansion@1.1.21`.

## Follow-ups

### F1 — `boolean@3.2.0` deprecation warning (`WARN 1 deprecated subdependencies`)

**Pre-existing; not introduced by this change.** Observed behaviour during this task:

- The first `pnpm install --lockfile-only --no-frozen-lockfile` (the run that performed a full
  re-resolution) printed `WARN 1 deprecated subdependencies found: boolean@3.2.0`.
- Every subsequent install printed no deprecation notice, including `pnpm install --frozen-lockfile`,
  a repeat of `--lockfile-only --no-frozen-lockfile`, the same command with `--force`, and a
  `--frozen-lockfile` run after deleting `node_modules/.modules.yaml`.

**The trigger was not determined.** It is tempting to attribute the notice to the package being
newly added to the store, but the last observation contradicts that: removing the installer's
module state and re-installing did not reproduce the warning. Treat the emission condition as
unverified — the finding that matters for the gate is that the warning is pre-existing and, on
current evidence, not a recurring one.

- Path: `nextjs_tailwind_shadcn_ts` → `@huggingface/transformers@4.2.0` → `onnxruntime-node@1.24.3`
  → `global-agent@3.0.0` → `boolean@3.2.0` (also via `roarr@2.15.4`).
- Registry reason: *"Package no longer supported. Contact Support at https://www.npmjs.com/support"*.
- `3.2.0` is the **final published version** of `boolean`; there is no patched release to move to.
- Evidence it predates this work: `boolean@3.2.0`, `global-agent@3.0.0`, and
  `@huggingface/transformers@4.2.0` are all present in the pre-change lockfile, and the
  brace-expansion diff touched none of them.

**Options**, none actionable without a `global-agent` release:
1. Wait for an upstream `global-agent` / `roarr` bump that drops the deprecated dependency.
2. Suppress the notice in `.npmrc`/pnpm config — cosmetic, hides real future deprecations. Not
   recommended: this repository treats suppressed signal as debt.
3. Switch the local AI stack off `onnxruntime-node` — a much larger change with real product
   impact, out of scope for a security patch.

**Recommendation**: leave as-is, revisit when `global-agent` or `onnxruntime-node` ships an update.
No override can be written today that both keeps the tree correct and silences this.

### F2 — Vitest experimental-typecheck notice

`pnpm run test` prints, on every run:

```
Testing types with tsc and vue-tsc is an experimental feature.
Breaking changes might not follow SemVer, please pin Vitest's version when using it.
```

- **Pre-existing and config-driven.** Vitest emits it whenever `test.typecheck.enabled` is `true`,
  which this repository sets deliberately in `vitest.config.ts:22-30` so new `*.test-d.ts`
  type-contract files gate today. Unlike F1, this notice *does* appear on every `pnpm run test`.
- Vitest's own text advises pinning the version. The manifest declares `"vitest": "^4.1.11"` — a
  caret *range*, not a pin, so the resolved version can float within 4.x. That is a genuine
  exposure to the SemVer risk the message describes, and it is the one thing here worth acting on
  if maintainers want it closed. **Note this would not remove the notice.** The warning is emitted
  at `vitest/dist/chunks/coverage.*.js:488`, gated solely on `resolved.typecheck.enabled`; the
  declared version range is never consulted. Pinning addresses the risk the message *talks about*,
  not the output itself.
- The notice is a static upstream string. The only supported way to stop it printing is to set
  `typecheck.enabled: false`, which would disable the `*.test-d.ts` type-contract gating this
  repository relies on (`vitest.config.ts:22-30`) — a real regression. Forking or patching Vitest
  to drop one `console.warn` is not a proportionate trade.

**Recommendation**: leave the notice as-is. Gate on Vitest's typecheck passing — the run reports
`Type Errors  no errors` — and record the line as known, accepted upstream noise. Note the
message's `vue-tsc` wording is generic: this repository sets no `checker` key, so Vitest defaults
to `tsc` against `./tsconfig.test.json` (`vitest.config.ts:22-30`). Separately, if maintainers want
the underlying SemVer exposure closed, exact-pinning `vitest` is the option — accepting that it
silences nothing and costs automatic security updates.

## Notes
- The change was committed on `fix/brace-expansion-audit` and submitted as a pull request against
  `main`; no release was cut. The two advisories are cleared locally by the override; CI re-verifies
  `pnpm audit` on the pull request head.
- The local `node_modules` was stale relative to the committed lockfile; `pnpm install` synced
  `next 16.3.5 → 16.3.6` and `zustand 5.0.14 → 5.0.15`. The committed lockfile already pinned
  those versions — no lockfile churn resulted, and no manifest change was made for them.
- `pnpm prune` removed a leftover `brace-expansion@1.1.16` virtual-store directory that nothing
  referenced after the update.
