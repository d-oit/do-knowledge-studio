# 051 — Vercel Deployment Fix & Prevention (2026-07-09)

## Problem

After merging the Next.js cleanup PR (#399), the production deployment at
https://do-knowledge-studio.vercel.app/ continued showing the old UI. The Vercel
deployment was failing silently, leaving the stale version live.

## Root Cause

Next.js 16 requires Node.js ≥ 20, but Vercel was using an older version because:

1. `package.json` had no `engines` field — Vercel didn't know which Node version to use
2. `vercel.json` didn't exist — Vercel inferred build config incorrectly
3. `.nvmrc` existed but Vercel may not read it for build (only for runtime)

## Fix Applied

### 1. `package.json` — Added `engines` field

```json
"engines": {
  "node": ">=20"
}
```

This tells Vercel to use Node.js 20+ for the build.

### 2. `vercel.json` — Created explicit build config

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "pnpm install"
}
```

This ensures Vercel uses the correct build commands and output directory.

### 3. `.nvmrc` — Already present (Node 22)

Created in earlier commit, kept as-is.

### 4. `AGENTS.md` — Added Deployment section

Documented Vercel requirements, configuration files, prevention steps, and
diagnostic commands to prevent future deployment failures.

### 5. `.deepsource.toml` — Improved config

- Added `plans/` to exclude patterns
- Added `skip_doc_coverage = ["test", "src"]` to reduce false positives
- Kept `JS_0067 = "off"` and `JS_R1005 = "off"` suppressions

## Prevention Checklist

Before pushing to `main`:

- [ ] `pnpm run build` passes locally
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `package.json` has `engines.node >= 20`
- [ ] `vercel.json` exists with correct config
- [ ] `.nvmrc` specifies Node 20+
- [ ] `pnpm-lock.yaml` is committed

Never remove or modify without approval:
- `engines` field in `package.json`
- `vercel.json`
- `.nvmrc`
- `build` script in `package.json`

## Related

- PR #399: Initial Next.js cleanup (caused the deployment issue)
- PR #400: Fixed Vercel config (resolved the deployment issue)
- Plan 048: Next.js cleanup audit (identified the migration)
- Plan 049: Feature implementation plan

## Verification

After merging this fix:

1. `pnpm run build` passes locally
2. Vercel deployment status shows "Ready"
3. https://do-knowledge-studio.vercel.app/ shows "DO Knowledge Studio"
4. All CI checks pass (Codacy, CodeQL, DeepSource, Vercel)
