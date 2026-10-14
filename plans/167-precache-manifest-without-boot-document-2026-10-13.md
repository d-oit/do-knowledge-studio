# Plan 167 — Precache Manifest Across Local and Adapter Builds

**Date:** 2026-10-13  
**Amended:** 2026-10-14 — adapter inventory and served-manifest repair  
**Related:** [ADR 041](ADRs/041-offline-precache-scope-and-upgrade-identity.md),
Plan 161, Plan 166, Plan 168.

## Incident

Authenticated Vercel logs for the production build and four open PR builds show
the precache generator failing after `next build`:

| Build | Deployment | Generator error |
|---|---|---|
| Production at `1f1fc50` | `dpl_BfBqazedX24tA9qm4RAgWakZ1hnB` | `.next/server/app/index.html` not found |
| #954 | `dpl_Cswq1cXWFUNNMSsHYQRgv9oFXXvQ` | `.next/server/app/index.html` not found |
| #953 | `dpl_FEG2cFxQ7gooQce8r2UNC9dJH18Z` | `.next/static/chunks` not found |
| #951 | `dpl_DFijzvyj9RHj6aCGoCEXxbWdsJS9` | `.next/static/chunks` not found |
| #952 | `dpl_KRwtfWdK6iG3jjZsc6CEtWnGfCj2` | `.next/static/chunks` not found |

The former document-only fix did not address the packaged asset path. The
adapter's config and static output live under `.next/output`; its assets are
served under `/_next/static`. Vercel's pinned builder source copies public files
to its static output only when absent, so generating the manifest only in
`public/` after that copy can leave the served manifest stale. The previous
“provider-only” diagnosis was incorrect; these logs identify a generator/output
contract mismatch.

## Change

- Select `.next/output/static/_next/static` when
  `.next/output/config.json` exists; otherwise select `.next/static`. A missing
  selected root or real JavaScript chunk fails closed; do not silently fall
  back to a different build's files.
- Recursively include `.js`, `.mjs`, `.css`, fonts (`.woff2`, `.woff`, `.ttf`,
  `.eot`, `.otf`), SVG, and raster images (`.png`, `.jpg`, `.jpeg`, `.webp`,
  `.avif`, `.gif`, `.ico`), including immutable subdirectories. Exclude source
  maps, WASM, and model weights.
- Write the same manifest to `public/precache-manifest.json` and, for adapter
  builds, `.next/output/static/precache-manifest.json`.
- Change `STATIC_CACHE` in `public/sw.js` with the manifest scope so an installed
  worker fetches the expanded manifest.
- Set the Node engine to `22.x` rather than an unbounded `>=22.0.0` range.
- [ADR 041](ADRs/041-offline-precache-scope-and-upgrade-identity.md) records the
  selected inventory and worker-identity requirements.

## Verification

| Check | Result |
|---|---|
| `pnpm exec vitest run src/lib/studio/precache-manifest-generator.test.ts` | 8/8 pass after repair |
| Omit the adapter served-manifest write, run its regression case | Fails at the byte-equality assertion; stale served manifest remains |
| Restore served-manifest write and rerun the suite | 8/8 pass |
| Omit the `_buildManifest.js` exclusion and run its regression case | Fails because the generator accepts the manifest-only inventory |
| Restore the real-chunk guard and rerun the suite | 8/8 pass |
| Node 22 `fs.cpSync` fixture reproduction | Copy succeeds; missing parent and file are created, so the #951 report is a false positive |
| #951 dependency check | `@tailwindcss/typography` is declared in `package.json` and lockfile; frozen-lockfile install succeeded |
| Node 22.x and frozen-lockfile install | `pnpm install --frozen-lockfile` succeeds after the engine change |
| Local production build and emitted-manifest comparison | Warm build writes 74 URLs; exact match for 66 supported `.next/static` assets plus 8 fixed shell URLs |
| Production offline and worker-upgrade browser proof | Offline E2E 6/6; a temporary no-op byte change triggered `registration.update()`, removed v3, preserved API v2, and populated v4; a separate Playwright context fetched a real chunk offline (200) |
| Repaired Vercel candidate, served-manifest and asset responses | Pending |

## Notes

- The earlier local 70-URL manifest and `VERCEL=1` experiment predate the
  adapter-path repair; neither proves output compatibility or deployment
  recovery.
- The first clean-worktree build emitted Next's “No build cache found” warning.
  Next docs describe first CI builds as an exception; the immediate warm local
  rebuild emitted no warning. Configure persistent CI caching if the warning
  recurs. The offline E2E runner initially inherited conflicting
  `NO_COLOR`/`FORCE_COLOR`; rerunning with `env -u NO_COLOR` was clean.
- Failed Vercel builds emitted the `>=22.0.0` engine-upgrade notice. The source
  now constrains the supported major; frozen-lockfile installation succeeds.
- Do not call the incident fixed in production until the repaired candidate is
  `READY`, its served manifest matches the generated manifest, and every listed
  supported asset responds successfully. Plan 168 tracks that gate and the
  ordered PR merges.
