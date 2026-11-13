# Plan 209 — Keep `@types/node` on the runtime's major

**Status**: Complete
**Date**: 2026-11-13
**Trigger**: Dependabot PR #1110, `@types/node` 22.20.5 → 26.6.6.

## Decision

Do not take the bump. Pin `@types/node` to the major of the Node runtime the
project actually runs, and tell Dependabot to stop proposing majors for it.

```yaml
ignore:
  - dependency-name: "@types/node"
    update-types:
      - "version-update:semver-major"
```

## Why the bump is refused, not deferred

`@types/node` describes a runtime. This repository runs 22 everywhere:
`engines` allows `>=22 <25`, `.nvmrc` says `22`, and all 13 CI workflows pin
`node-version: '22'`. Types for 26 describe APIs — `node:sqlite`, newer test
runner options, permission-model additions — that do not exist in the
interpreter that executes the code.

That failure mode is invisible to every gate here. `tsc` checks code against
the type package; it never asks what the runtime exports. So a call that
typechecks against 26 and throws `TypeError: undefined is not a function` on
22 passes lint, typecheck, unit tests, e2e and build. The dependency that
looks most harmless in the diff is the one that can break production with no
signal in CI.

## Why pinning is the right direction rather than moving the runtime

Types older than the runtime fail loudly: code using a Node 24-only API does
not typecheck on 22, and someone notices at review time. Types newer than the
runtime fail silently at run time. `engines` allows up to 24, so the pin keeps
types at the conservative end of the allowed window — the direction where the
error surfaces in front of a human.

Migrating the runtime to 26 is a legitimate alternative and a much larger
change: 13 workflow files, the engine range, the lockfile, and a re-verification
of every Node-facing script. It is a separate decision about what runtime the
project supports, not something a dependency bot should decide — and if it is
ever wanted, the engine range, the workflows and the lockfile move together
in one planned change.

## Verification

- `yamllint -c .yamllint.yml .github/dependabot.yml` → clean; the CI-parity
  config (120-char lines, 2-space indent) → clean.
- `python3 -c "yaml.safe_load(...)"` → the npm entry now carries
  `ignore: [{dependency-name: '@types/node', update-types: [...]}]`, and the
  `github-actions` entry keeps its gitleaks pin untouched.
- Both workspaces (`package.json`, `packages/dks-mcp/package.json`) still
  declare `^22.0.0`; `grep` for `node:sqlite` or `node:test` across `src/` and
  `e2e/` finds nothing, so no shipped code needs the newer surface.

The ignore rule takes effect on the next Dependabot run; the open PR is closed
with this rationale rather than left to rot.
