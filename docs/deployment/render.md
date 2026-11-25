# Render deployment

The app is a pnpm 12 monorepo (`pnpm-workspace.yaml`, `packages/*`, committed
`pnpm-lock.yaml`). It must be built with pnpm, never with Bun or npm.

## Root cause of the 2026-11-24 deploy failure

The Render service had the build command `bun install bun run dev`. Bun cannot
parse the pnpm lockfile format, so it ignored the lockfile, then failed to
resolve the workspace dependency `dks-core` (which lives in `packages/dks-core`
and is only resolvable through pnpm workspaces). Running `dev` as a build
command is also incorrect for production.

## Permanent fix

`render.yaml` at the repository root defines the correct configuration:

- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start` (`next start`, honoring Render's `PORT`)
- Runtime: Node 22, resolved from `.nvmrc`

If the service is managed by a Render Blueprint (its name matches
`do-knowledge-studio`), the settings sync automatically on merge. If the
service was created manually, update it once in the Render dashboard:

- **Build Command:** `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- **Start Command:** `pnpm start`

Rules that keep future deploys working:

1. Never set a build or start command that invokes `bun`.
2. Keep `pnpm-lock.yaml` committed and always install with
   `--frozen-lockfile` so CI and deploys use identical dependency trees.
3. `pnpm build` builds `dks-core` before `next build`; do not invoke
   `next build` directly.
4. Node version changes go in `.nvmrc`, which Render reads automatically.
