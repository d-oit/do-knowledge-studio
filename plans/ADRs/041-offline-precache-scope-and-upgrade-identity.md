# ADR 041: Offline Precache Scope and Upgrade Identity

**Date**: 2026-09-30
**Status**: Implemented locally; production verification pending
**Amended**: 2026-10-14 — adapter inventory, output selection, and served manifest
**Related**: Plan 161, Plan 158, ADR 036, ADR 018
**Amends (in part)**: ADR 036 (E2E target — production mode becomes an explicit
opt-in that is *required* for offline assertions, instead of the removed
default)

## Context

The app is local-first: the entire promise is that it keeps working when the
network does not. Plan 158 made the service worker precache the boot document's
own assets instead of four hand-written URLs, which fixed the cold-offline
blank page — for the boot path only.

`AppShell` code-splits six views. A lazily imported view is referenced by no
HTML, so a manifest derived from `.next/server/app/index.html` cannot contain
it. Measured on the pre-fix build: 17 of 36 emitted chunk files were precached.
A first offline navigation into any unvisited view rejected its dynamic import
and rendered `"<View> failed to load"` (Plan 161 reproduces all six).

Two design questions had no recorded answer:

1. **Scope.** Which emitted artifacts are "app code the offline contract
   covers", and how are they identified as build output changes?
2. **Upgrade identity.** The manifest is fetched by the worker at install time.
   If the manifest widens but the worker's bytes do not change, an existing
   installation never reinstalls and never sees the wider list — the fix
   reaches new users only.

## Decision

### 1. Precache emitted supported assets, not a classification of them

The generator selects `.next/output/static/_next/static` when
`.next/output/config.json` exists; otherwise it selects `.next/static`. It
recursively inventories supported JavaScript, module, CSS, font, SVG, and raster
image files and maps their paths to `/_next/static/...`. The extension allowlist
excludes source maps, WASM, and model weights.

The selected root must exist and contain a real `.js` chunk under `chunks/` or
`immutable/chunks/`; `_buildManifest.js` alone is not app code. The generator
does not fall back to the other build root, because that could produce a
plausible but incomplete manifest from unrelated output.

Chunks are **not** attributed to features. Their names are content hashes of
minified output, so attribution would mean parsing minified source and guessing
— and a wrong guess is an offline view that cannot load, which is the defect
being fixed.

### 2. Fail closed on the selected inventory; the boot document is not a source

A manifest that cannot satisfy a lazy import is worse than no manifest, because
it looks correct. The generator exits nonzero when the selected static root is
absent or has no real JavaScript chunk. Empty CSS/font/image sets remain valid:
the app can legitimately ship without a particular optional asset category.

The boot document is not scanned. The inspected production and #954 builds
failed because `.next/server/app/index.html` was absent; #953, #951, and #952
failed because `.next/static/chunks` was absent. The successful `next build`
step does not guarantee those assumed paths exist in adapter output. Plan 167
records the deployment IDs and exact errors.

For adapter builds, the generated manifest is written both to `public/` and to
`.next/output/static/precache-manifest.json`. Vercel's builder copies public
files into its static output only when they are absent; writing only after that
copy can therefore leave the served copy stale. The two manifests must be
byte-identical.

### 3. The cache identity changes whenever the manifest scope changes

The manifest is a runtime fetch, so scope changes are invisible to an installed
worker. Any change to what the manifest *contains* therefore must also change
`STATIC_CACHE` in `public/sw.js`. The installer's `install` handler is
unchanged: it already carries `urls` through the chain and adds each entry
independently, so one 404 cannot reject the whole install. Old caches are
removed in `activate` — never from application code — so the cutover is
atomic from the user's perspective.

### 4. Offline assertions run against a production build, explicitly

`playwright.config.ts` gained `PLAYWRIGHT_PRODUCTION=1`: it serves
`pnpm run start`, refuses to reuse a server already on the port, and gates
`e2e/offline-views.spec.ts` out of the default development run and out of every
non-Chromium project. Precache URLs are build output; against `next dev` the
same assertion would be measuring development bundles and could neither fail
nor pass honestly.

This is deliberately narrower than ADR 036's "production build is the canonical
E2E target": the default loop stays `next dev` for speed, and production mode is
required only where build output is the subject under test.

## Consequences

- The offline contract covers every supported emitted code and media asset;
  runtime backfill (`cacheFirst`) remains a bonus path, not the mechanism the
  contract depends on.
- First-install transfer is the fixed shell URLs plus selected emitted assets.
  Its size depends on the build inventory and must be measured for material
  scope changes.
- Every future manifest-scope change must also change `STATIC_CACHE`. The
  worker comment and this ADR document the rule; changing only the generator
  leaves existing installs on the old manifest.
- WASM and model weights stay out. If the AI harness is ever expected to infer
  fully offline with a bundled model, that is a separate, explicitly sized
  decision.
- `pnpm run test:e2e` still means the fast loop; `test:e2e:offline` (and
  `PLAYWRIGHT_PRODUCTION=1 test:e2e`) mean the production loop. CI runs the
  production loop behind an `offline` paths filter — the worker, the manifest and
  its generator, the boot wiring (`layout.tsx`, `app-shell.tsx`,
  `offline-indicator.tsx`, `service-worker-registration.tsx`), the spec itself,
  `playwright.config.ts`, and the dependency files that decide chunking. The
  `e2e-tests` job also gates on that filter, because a generator-only change is
  `tooling`, not `frontend`, and would otherwise never reach the job.

## Alternatives rejected

| Alternative | Why not |
|---|---|
| Glob `.next/static/**` entirely | Would pull WASM, model weights and source maps into mandatory install |
| Attribute chunks to views by parsing minified source | Brittle against every bundler change; a wrong guess is a silent offline failure |
| Prewarm lazy views at install by navigating them | Requires executing view code and its network calls during install; slow and side-effectful |
| Rely on runtime cache-first backfill only | Exactly the status quo: it cannot help a *first* offline visit, which is the reported case |
| Use boot-document URLs as the complete inventory | Excludes lazy chunks and fails on inspected builds where the document is absent |
| Descriptor added to a build manifest to name view chunks | Turbopack exposes no stable view→chunk map; maintaining a mapping is the classification problem again |
| Ship a `sw.js` that always re-fetches the manifest with `cache: 'reload'` in `install` | The fetch already bypasses the cache; the problem was the worker never reinstalling, so install never ran |
