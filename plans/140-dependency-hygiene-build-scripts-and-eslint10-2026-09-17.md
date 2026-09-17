# Plan 140 — Dependency Hygiene: Build-Script Allowlist Decision + ESLint 10 Blocker (2026-09-17)

**Type**: dependency hygiene decision + upstream blocker record
**Scope**: `package.json` (`pnpm.ignoredBuiltDependencies`), planning docs
**Follows**: plans/139 §6 items 1–2

## 1. Build-script allowlist decision (resolved)

pnpm 10 blocks dependency build scripts by default, so every install printed:

```
Ignored build scripts: core-js@3.49.0, esbuild@0.28.1, onnxruntime-node@1.24.3,
                       protobufjs@7.6.6, unrs-resolver@1.12.2
```

All five are ignored **deliberately** — none of their scripts is needed here:

| Package | Script | Purpose | Why it stays unbuilt |
|---|---|---|---|
| `core-js@3.49.0` | `postinstall` → `node -e "try{require('./postinstall')}catch(e){}"` | prints a donation banner | cosmetic only |
| `esbuild@0.28.1` | `postinstall` → `node install.js` | fallback binary install | the platform binary comes from `@esbuild/linux-x64@0.28.1` (present); tests and build pass without it |
| `onnxruntime-node@1.24.3` | `install` → `node ./script/install` | downloads native Node binaries | Node path only — unreachable from the browser/WASM client (plans/138 §5.2); prebuilt binaries already ship in the tarball |
| `protobufjs@7.6.6` | `postinstall` → `node scripts/postinstall` | warns dependents whose version scheme mismatches | diagnostic only |
| `unrs-resolver@1.12.2` | `postinstall` → `node postinstall.js` | fallback native binding | `@unrs/resolver-binding-linux-x64-gnu@1.12.2` is present |

**Decision**: record them in `pnpm.ignoredBuiltDependencies` — the explicit form of
today's default — rather than approving them via `pnpm.onlyBuiltDependencies`.
Approving would add supply-chain surface and, for `onnxruntime-node`, a large
binary download for a code path this app never executes.

**Verification**

| Check | Result |
|---|---|
| `rm -rf node_modules && CI=true pnpm install --frozen-lockfile` | silent — no `Ignored build scripts` warning |
| `CI=true pnpm install --frozen-lockfile` (no-op re-run) | silent |
| `pnpm-lock.yaml` | unchanged (the setting is not lockfile state) |
| `./scripts/quality_gate.sh` | green — lint, tests, build all still resolve their platform binaries |

**Local note**: a checkout whose `node_modules/.modules.yaml` predates the setting
replays the old warning on a no-op install. `pnpm install --force` or
`rm -rf node_modules` regenerates the record. Fresh installs (CI, Vercel, new
clones) are silent.

## 2. ESLint 10 blocker (documented — not actionable yet)

plans/139 §6 item 1 flagged that pnpm warns
`deprecated eslint@9.39.4: This version is no longer supported` on every install.
The warning cannot be cleared by a patch bump: **`eslint@9.39.5` — the current
`maintenance` dist-tag — is deprecated too**. Only the 10.x line is supported, and
10.x is blocked for this repository:

1. **`eslint-plugin-react@7.37.5` explicitly does not support ESLint 10.** It is
   the latest published version (no 8.x/9.x exists) and its peer range stops at
   `^9.7`. Its maintainer, on the ESLint 10 compatibility issue
   (jsx-eslint/eslint-plugin-react#3977): *"we're explicitly not compatible with
   eslint 10. until the peer dep range is updated, one should not attempt to use
   eslint 10 with this plugin."*
2. **ESLint 10 removed the `context` members that plugin depends on** —
   `context.getFilename()`, `getSourceCode()`, `getCwd()`, `parserOptions`,
   `parserPath` (official migration guide). Reported impact on the plugin:
   38 of its 101 rules throw.
3. **The plugin is unavoidable here.** `eslint-config-next@16.3.5` depends on
   `eslint-plugin-react: ^7.37.0`, and `eslint.config.mjs` loads
   `eslint-config-next/core-web-vitals` + `/typescript`, which supply the
   `react/*` rules the config references. `eslint-config-next` has an open
   ESLint 10 compatibility issue (vercel/next.js#91702).
4. `eslint-plugin-jsx-a11y@6.10.2` (also via `eslint-config-next`) declares a
   `^9` ceiling as well.

Forcing the upgrade would mean pinning peer ranges past their declared ceilings
and accepting known-broken rules — and possibly editing `eslint.config.mjs`,
which is off-limits without an explicit request (AGENTS.md hard rule).

**Revisit when** `eslint-plugin-react` publishes an ESLint 10 peer range (or
vercel/next.js#91702 closes). Node is already compliant: ESLint 10 needs
`^20.19.0 || ^22.13.0 || >=24`, and this repo pins Node 22 (`.nvmrc`, CI, Vercel).

Until then the deprecation warning is a known, upstream-owned condition — the
lint result itself is unaffected.

## 3. Follow-ups

1. **`@eslint/js` is still `^9.39.5`** — bump together with the ESLint 10
   migration (its 10.x line requires `eslint: ^10.0.0`).
2. **DeepSource: JavaScript metric-level failure** — plans/138 §5.3.
   → **Root-caused in plans/141 §1** (the check is *skipped*, not failing: the
   account's analysis quota is exhausted; 36 findings triaged in plans/141 §2).
3. **Four deferred review findings** — plans/137 §5.
