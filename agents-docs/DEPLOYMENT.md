# Deployment (Vercel)

> Reference doc extracted from `AGENTS.md` (Plan 157 follow-up) to satisfy the
> progressive-disclosure rule — `AGENTS.md` declares
> `MAX_LINES_AGENTS_MD=250` and must stay small.
>
> **Critical**: this project deploys to Vercel. Breaking the build breaks the
> live site.

### Requirements

- **Node.js ≥ 22.10** — Next 16 hard-asserts `>=20.9.0` in `bin/next`. The
  `engines.node` floor was `">=20"`, which let a Node 20.5 machine satisfy
  `engine-strict` at install time and only then crash the build with a
  confusing message. Now `">=22.10.0"`, matching `.nvmrc` and CI, so the
  failure happens at install with a clear message (Plan 158 P2-8).
- **pnpm** — see the install-command note below.
- **Build must pass** — `pnpm run build` runs on every push to `main`.

### Install command — do not add one

`vercel.json` deliberately sets **no** `installCommand`. Per
https://vercel.com/docs/package-managers, an override makes Vercel use the
*oldest* version of the named package manager in the build image — for pnpm
that is **v6**, which cannot read this repo's `lockfileVersion: '9.0'` or its
`pnpm.overrides`. With no override, Vercel infers pnpm from `pnpm-lock.yaml`
and picks the right major.

The `packageManager: "pnpm@10.30.3"` field only takes effect when Corepack is
enabled on the Vercel project (`ENABLE_EXPERIMENTAL_COREPACK=1`). Do not assume
it is active.

`outputDirectory` is likewise absent on purpose: Vercel's own error docs say
to remove it for Next.js projects unless `distDir` is overridden, which this
repo does not. See Plan 158 P0-1 / P1-2.

### Configuration Files

| File | Purpose | Do NOT delete |
|------|---------|---------------|
| `package.json` | `engines.node` tells Vercel which Node version | `engines` field |
| `vercel.json` | Framework + build command only | entire file |
| `.nvmrc` | Node version for local dev and CI | entire file |

### Preventing Deployment Failures

1. **Always run `pnpm run build` locally** before pushing to `main`
2. **Never remove the `engines` field** from `package.json`
3. **Never add `installCommand` or `outputDirectory`** to `vercel.json`
4. **Never change the `build` script** without re-running `pnpm run build`
5. **If adding new deps**, run `pnpm install` to update `pnpm-lock.yaml`
6. **If upgrading Next.js**, check Node.js version requirements

### Diagnosing Vercel Failures

```bash
# Check Vercel deployment status
gh pr checks <PR#> | grep -i vercel

# Check production deployment
gh api repos/d-oit/do-knowledge-studio/deployments --jq '.[] | select(.environment == "Production")'

# Verify build passes locally
pnpm run build
```

### Common Vercel Failure Causes

| Cause | Symptom | Fix |
|-------|---------|-----|
| Node.js version too old | Build fails with syntax errors | Ensure `engines.node >= 20` in package.json |
| Missing `vercel.json` | Vercel uses wrong build command | Add vercel.json with explicit config |
| `pnpm-lock.yaml` out of date | Install fails | Run `pnpm install` and commit lockfile |
| TypeScript errors | Build fails | Run `pnpm run typecheck` before pushing |
| Missing dependencies | Import errors | Run `pnpm install` and commit changes |
| Major dependency bump (breaking API) | Type errors in build only | Run `./scripts/verify-deps.sh` after any dependabot merge |
| TypeScript major bump (deprecations) | TSconfig option deprecated | Add `"ignoreDeprecations": "6.0"` to tsconfig.base.json |

### Dependency Upgrade Rules

When merging dependabot PRs or manually bumping dependencies:

1. **Always run `./scripts/verify-deps.sh`** after any dependency version change.
2. **Major version bumps** (semver X.0.0) require checking the changelog for breaking API changes — do not auto-merge.
3. **TypeScript major bumps** may deprecate tsconfig options — check `pnpm run typecheck` output for deprecation warnings treated as errors.
4. **UI library major bumps** (shadcn primitives, react-resizable-panels, radix) may rename exports — check `pnpm run build` for type errors.
5. **After merging any dependabot PR**, immediately run the full quality workflow including `pnpm run build` and push a fix if needed.
