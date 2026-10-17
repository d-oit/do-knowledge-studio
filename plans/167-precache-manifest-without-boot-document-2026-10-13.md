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
- Bump `STATIC_CACHE` when the manifest scope changes: #953 changed v3→v4 and
  #951 changed v4→v5 for the plugin-emitted typography CSS.
- Set the Node engine to `>=22.0.0 <25.0.0`, excluding unsupported future majors while
  preserving Node 22–24 support.
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
| #951 rendered typography and cache v5 | Focused Markdown/chat E2E 40/40 across four projects; production offline E2E 6/6; production-browser preview and assistant prose use different light/dark text colors and retain a 4px quote border; the 74-URL precache manifest includes both emitted CSS assets |
| Node 22.x and frozen-lockfile install | `pnpm install --frozen-lockfile` succeeds after the engine change |
| Local production build and emitted-manifest comparison | Warm build writes 74 URLs; exact match for 66 supported `.next/static` assets plus 8 fixed shell URLs |
| Production offline and worker-upgrade browser proof | Offline E2E 6/6; a temporary no-op byte change triggered `registration.update()`, removed v3, preserved API v2, and populated v4; a separate Playwright context fetched a real chunk offline (200) |
| Repaired Vercel candidate and production, manifest and asset responses | #953 candidate and production deployments are `READY`; the served manifest is HTTP 200 with 74 unique URLs, and all 74 listed assets return HTTP 200 with expected MIME types |

## Notes

- The earlier local 70-URL manifest and `VERCEL=1` experiment predate the
  adapter-path repair; neither proves output compatibility or deployment
  recovery.
- The first build in both #953 and #951 worktrees emitted Next's “No build
  cache found” warning; each immediate warm rebuild emitted none. Configure
  persistent CI caching as a tracked follow-up. The offline E2E runner initially
  inherited conflicting `NO_COLOR`/`FORCE_COLOR`; `env -u NO_COLOR` reran clean.
- **2026-10-17 — closed by [Plan 176](176-plans-backlog-drain-2026-10-17.md):**
  the `build` job in `.github/workflows/ci-and-labels.yml` now caches
  `.next/cache`, keyed on the runner OS + lockfile hash + the resolved Next
  version with a restore-key fallback; validated with `yamllint` and
  `actionlint`.
- Failed Vercel builds emitted the `>=22.0.0` engine-upgrade notice. The source
  now constrains the supported major; frozen-lockfile installation succeeds.
- #953 merged at `3025b0d27d36eea53e0e96a02f67453b96cf224f`. Its candidate
  manifest/assets and merged production manifest/assets are verified: 74 URLs
  each, all HTTP 200 with expected media types. The incident is production-fixed.
