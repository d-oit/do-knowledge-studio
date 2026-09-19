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

## 2. ESLint 10 blocker — resolved 2026-09-18 (upgraded with a workaround)

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

**Resolution (2026-09-18).** The blocker was re-checked against the upstream
sources and then resolved by a documented workaround:

- ESLint **9.39.5 reached end-of-life on 2026-08-06** (no fixes, security
  included) — see the official [version support policy](https://eslint.org/version-support/).
  Staying was therefore a "stop the rot" decision, not a safe default.
- The crash has one root cause: `eslint-plugin-react@7.37.5` reads the React
  version through `context.getFilename()`, removed in ESLint 10. Reproduced
  directly: `eslint@10` against this config throws
  `TypeError: Error while loading rule 'react/no-direct-mutation-state':
  contextOrFilename.getFilename is not a function`.
- Adding `settings.react.version = "19"` to `eslint.config.mjs` skips that
  auto-detection path. Verified: `eslint@10.11.0 .` over the whole repository is
  clean (exit 0, zero warnings). The pin is accurate — the app is React 19 — so
  no rule coverage changes.
- `eslint-plugin-jsx-a11y@6.10.2` and `eslint-plugin-import@2.32.0` still
  declare `^9` peer ceilings. Those ranges are accepted **explicitly** via
  `pnpm.peerDependencyRules.allowedVersions` in `package.json`, so install output
  stays warning-free and the acceptance is visible in-repo rather than looking
  like a defect. `typescript-eslint@8.70`, `eslint-plugin-react-hooks@7.1.1` and
  `eslint-plugin-react-refresh@0.5.7` already allow `^10`.
- `@eslint/js@9` was a direct dependency imported nowhere — dropped rather than
  bumped.
- Node was already compliant: ESLint 10 needs `^20.19.0 || ^22.13.0 || >=24`,
  and this repo pins Node 22 (`.nvmrc`, CI, Vercel; local 22.23.2).

**Remove the workaround when** `eslint-plugin-react` ships ESLint 10 support
([#3977](https://github.com/jsx-eslint/eslint-plugin-react/issues/3977), open
with PRs #3979/#4022; Next.js tracks its side in
[vercel/next.js#89764](https://github.com/vercel/next.js/issues/89764)). At that
point drop `settings.react.version`, re-test without it, and keep the peer rule
only while a plugin still caps at `^9`.

## 3. Follow-ups

1. **ESLint 10 workaround** — drop `settings.react.version` once
   `eslint-plugin-react` supports ESLint 10 (§2), and drop the peer rule when no
   plugin caps at `^9` any more.
2. **DeepSource: JavaScript metric-level failure** — plans/138 §5.3.
   → **Root-caused in plans/141 §1** (the check is *skipped*, not failing: the
   account's analysis quota is exhausted; 36 findings triaged in plans/141 §2).
3. **Four deferred review findings** — plans/137 §5: all resolved
   (plans/142 §1–2, plans/144 §1–2).
