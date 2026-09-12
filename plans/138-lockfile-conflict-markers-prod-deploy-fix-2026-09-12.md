# Plan 138 — Production Deploy Fix: Committed Lockfile Conflict Markers (2026-09-12)

**Type**: incident record (production deployment)
**Scope**: `pnpm-lock.yaml` on `main`
**Follows**: plans/137 (open-PR sweep — PR #773 merge)

## 1. Symptom

Every Vercel deployment for `main` head `3787e337` (the #773 squash merge) failed:

```
Deployment has failed — run this Vercel CLI command:
npx vercel inspect dpl_46me2YFdPVjVGCPmZE7a2YrZVgWA --logs
```

The Vercel preview deployments for the same branch (`8acd0fd4`, `c496a222`) failed
identically. GitHub-hosted checks were **all green** (Build, Unit, E2E, Coverage,
Quality Gate, CodeQL, Dependency Verify, security scans), so the failure was
invisible to CI.

## 2. Root cause

`pnpm-lock.yaml` was committed to `main` **with unresolved Git conflict markers**
(lines 7–28), together with a stale `overrides:` block:

```
<<<<<<< HEAD
=======
overrides:
  lodash: ^4.18.0
  ...
  onnxruntime-node@1.24.3>adm-zip: '-'
>>>>>>> 9acf66e (fix(studio): resolve Codacy findings on N1-N7 sprint tree)
importers:
```

The correlation with the deploy status is exact and single-variable — the lockfile
is the only dependency-layer change in the failing commit:

| Commit | Production deploy | Conflict markers in `pnpm-lock.yaml` |
|---|---|---|
| `1bc3dc7` (#777) | success | 0 |
| `5de1f4a` (#778) | success | 0 |
| `3787e337` (#773) | **failure** | **3** |

`1bc3dc7` and `5de1f4a` also have **no `overrides:` key** at all in the lockfile,
i.e. the conflict block was newly introduced by the #773 merge and does not
belong in the file.

### Why CI stayed green

pnpm ≥ 8 auto-resolves lockfile conflict markers in memory
(`Merge conflict detected in pnpm-lock.yaml and successfully merged`), so
GitHub Actions' `pnpm install --frozen-lockfile` exits 0 on the same file. The
markers only break consumers that do not perform that in-memory merge — which is
what the Vercel build shows.

### Why the `overrides:` block must not stay either

Keeping the block (in either the committed order or reordered to match
`package.json` exactly) makes pnpm fail hard in CI mode:

```
ERR_PNPM_LOCKFILE_CONFIG_MISMATCH  Cannot proceed with the frozen installation.
The current "overrides" configuration doesn't match the value found in the lockfile
```

pnpm does **not** honour the top-level `overrides` field in `package.json` (its
effective overrides config is empty), so a recorded `overrides:` block can never
match. The lockfile therefore has to record no overrides — which is exactly the
shape of the last two known-good lockfiles.

## 3. Fix

Delete the 22-line conflict block. **Pure deletion — no resolution changes:**

- `adm-zip` stays excluded from the graph (`onnxruntime-node@1.24.3` snapshot
  still omits it, matching `"onnxruntime-node@1.24.3>adm-zip": "-"` intent).
- `sharp@0.35.4` / `@huggingface/transformers@4.2.0` pins are unchanged.
- `diff` against `origin/main` is deletions only.

`pnpm install --lockfile-only --no-frozen-lockfile` was considered (it rewrites
the lockfile to pnpm's own canonical form) but **rejected**: it re-adds
`adm-zip@0.5.18`, downgrades the transformers `sharp` pin to `0.34.5`, and drops
the `@types/node` peer suffix — an unrelated dependency change that does not
belong in a deploy-unblocking fix.

## 4. Verification

| Check | Result |
|---|---|
| `CI=true pnpm install --frozen-lockfile` | exit 0, no `Merge conflict detected`, no `CONFIG_MISMATCH` |
| `git diff origin/main -- pnpm-lock.yaml` | 22 deletions, 0 insertions |
| `pnpm run build` (Next.js 16.2.12 / Turbopack) | clean, 0 warnings, 4/4 static pages |
| `grep -c adm-zip pnpm-lock.yaml` | 0 (deliberate exclusion preserved) |

## 5. Follow-ups (documented, not ignored)

1. **Top-level `overrides` in `package.json` are inert under pnpm.** All 17
   entries (lodash, undici, dompurify, prismjs, diff, nanoid@3, js-yaml,
   adm-zip, …) are silently not enforced by `pnpm@10.30.3`; the pins survive only
   because an older lockfile baked them in. Moving them to `pnpm.overrides`
   (and deciding on `pnpm.onlyBuiltDependencies`) needs its own plan + security
   re-scan, because it changes resolved versions.
2. **`Ignored build scripts: onnxruntime-node@1.24.3`** — pnpm 10 blocks
   dependency build scripts by default. Harmless for the browser bundle
   (`onnxruntime-node` is the Node path, unreachable from the WASM client), but
   the allowlist decision should be recorded.
3. **DeepSource: JavaScript** still reports failure at the *metric* level while
   every posted finding is `isOutdated` or `skip = true` in `.deepsource.toml`
   (plans/137 §5.2). Not a ruleset-required check.
4. **Four deferred review findings** from plans/137 §5 (semantic type-filter
   ordering, Markdown-context mention extraction, type-selector keyboard trap,
   local-adapter consumer fallback).
