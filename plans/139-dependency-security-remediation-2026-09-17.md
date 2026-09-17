# Plan 139 — Dependency Security Remediation: Clear the Open Dependabot Alerts (2026-09-17)

**Type**: security remediation + quality-gate repair
**Scope**: `package.json` (`pnpm.overrides`, `devDependencies`), `pnpm-lock.yaml`,
`tests/install-hooks.bats`
**Follows**: plans/138 (lockfile incident), plans/127 (nightly Dependabot alert check)

## 1. Symptom

The nightly `Dependabot Alert Check` workflow (plans/127) failed on **09-12,
09-14, 09-15 and 09-16** — by design it exits 1 whenever any open alert exists.

Five alerts were open (60 `fixed`, 2 `auto_dismissed` at the time of writing):

| # | Severity | Package | Installed | First patched |
|---|---|---|---|---|
| 70 | high | `js-yaml` | 4.3.1 | 4.3.2 |
| 63 | high | `browserslist` | 4.28.2 | 4.28.7 |
| 62 | high | `browserslist` | 4.28.2 | 4.28.7 |
| 65 | medium | `vitest` | 4.1.10 | 4.1.11 |
| 64 | medium | `@vitest/mocker` | 4.1.10 | 4.1.11 |

Dependabot could not clear them on its own:

- The 09-12 updater run (id `34697620104`) logged
  `security_update_not_possible` for `browserslist` (latest-resolvable 4.28.2
  < lowest-non-vulnerable 4.28.7) and for `js-yaml` (4.3.1 < 4.3.2).
- The one PR it did open for the group, **#780**, bundled `@vitest/mocker`
  4.x → **5.0.0** (a major bump requiring Node 22 / Vite 6.4 with 20+ breaking
  changes) and was closed on 09-16 with a roast verdict.

## 2. Root cause

Every vulnerable package was pinned **below** its first-patched version:

- `js-yaml` — `pnpm.overrides.js-yaml: ^4.3.1`, transitive via
  `eslint` → `@eslint/eslintrc`.
- `browserslist` — transitive via `next`/`styled-jsx`/`@babel` and
  `update-browserslist-db`; no override existed, so the lockfile kept 4.28.2.
- `vitest` / `@vitest/mocker` — direct `devDependencies` pinned at `^4.1.10`.

## 3. Fix

| File | Change | Rationale |
|---|---|---|
| `package.json` | `pnpm.overrides.js-yaml` `^4.3.1` → `^4.3.2` | moves the pin onto the first patched release |
| `package.json` | add `pnpm.overrides.browserslist: ^4.28.7` | transitive dep has no direct specifier to raise |
| `package.json` | `vitest` `^4.1.10` → `^4.1.11` | patch-level bump, pulls `@vitest/mocker@4.1.11` |
| `package.json` | `@vitest/coverage-v8` `^4.1.10` → `^4.1.11` | its peer is pinned to the exact vitest version |

Lockfile re-resolved with `pnpm install --lockfile-only --no-frozen-lockfile`:

| Package | Before | After |
|---|---|---|
| `js-yaml` | 4.3.1 | **4.3.2** |
| `browserslist` | 4.28.2 | **4.29.0** |
| `update-browserslist-db` | 1.2.3 | 1.3.3 |
| `vitest` (+ `@vitest/*`) | 4.1.10 | **4.1.11** |

`browserslist@4.29.0` additionally pulls its data packages
(`baseline-browser-mapping@2.11.24`, `caniuse-lite@1.0.30001810`,
`electron-to-chromium@1.5.430`, `node-releases@2.0.55`). None of the added or
changed packages declare install scripts, so the `Ignored build scripts` list
(plans/138 §5.2) is unchanged.

Lockfile invariants from plans/138 §3 all hold: **0** conflict markers,
`adm-zip` present only as the `npm:adm-zip@0.6.1` override mapping (0.5.18 is
*not* re-added), the `sharp@0.35.4` pin is intact, and the
`@types/node@26.1.1` peer suffix is preserved.

## 4. Gate repair found during verification

`./scripts/quality_gate.sh` failed on `tests/install-hooks.bats` — **all 9** of
that file's tests. Reproduced on `origin/main` in a clean worktree, so it is
pre-existing and unrelated to the dependency change.

Cause: Plan 131 G7 rewrote `scripts/install-hooks.sh` to activate the committed
`.githooks/` directory via `core.hooksPath` instead of copying hook files into
`.git/hooks`. The suite still asserted the old copy-into-`.git/hooks` behaviour,
i.e. it tested an implementation that no longer exists. CI stayed green because
it runs the gate with `--changed`, which never touches that file.

Fix (separate commit): the suite is rewritten against the current contract —
`core.hooksPath` activation, no `.git/hooks` copies, idempotent re-runs,
non-git skip, the four malformed-repository guards, and behavioural tests of
the committed hooks (conventional-commit prefix, 120-character header boundary
in both directions). **14 tests, all passing** (previously 9 failing).

## 5. Verification

| Check | Result |
|---|---|
| `CI=true pnpm install --frozen-lockfile` | exit 0, no `Merge conflict detected`, no `CONFIG_MISMATCH` |
| Lockfile diff vs `main` | only the 4 intended upgrades + browserslist data packages |
| `./scripts/verify-deps.sh` | ALL CHECKS PASSED (lockfile sync, typecheck, lint, tests, build) |
| `./scripts/quality_gate.sh` | PASSED (after the §4 gate repair) |
| `bats tests/` | 14/14 in `install-hooks.bats`; full suite green |
| `gh api …/dependabot/alerts?state=open` | 5 → **0** (post-merge re-scan) |
| `Dependabot Alert Check` workflow | dispatched manually, green |
| Vercel production deploy | watched after merge (lockfile changes broke prod in plans/138) |

## 6. Follow-ups (documented, not ignored)

1. **`eslint@9.39.4` is deprecated** — pnpm prints
   `WARN deprecated eslint@9.39.4: This version is no longer supported` on
   every install. `eslint: ^9` needs a bump to a supported major, which also
   drags `eslint-config-next`, `typescript-eslint` and the plugin set. Own plan.
2. **`Ignored build scripts`** (`core-js`, `esbuild`, `onnxruntime-node`,
   `protobufjs`, `unrs-resolver`) — the allowlist decision from plans/138 §5.2
   is still open.
3. **DeepSource: JavaScript metric-level failure** with no blocking finding —
   plans/138 §5.3.
4. **Four deferred review findings** from plans/137 §5 (semantic type-filter
   ordering, Markdown-context mention extraction, type-selector keyboard trap,
   local-adapter consumer fallback).
