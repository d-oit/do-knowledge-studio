# Plan 158 — September 2026 Best-Practice Audit (GOAP Research Swarm)

**Date**: 2026-09-28
**Method**: GOAP orchestrator + 4 parallel research agents (scout), each
confined to one domain, each required to cite a primary source
(nextjs.org, w3.org, MDN, web.dev, vercel.com, react.dev, zustand docs,
developer.chrome.com). Every finding below was then **independently re-verified
against the running app** before being ranked. Three candidates were rejected
by that verification — see §4.
**Status**: Audit complete; P0-1, P0-2, P0-3 and P1-2 remediated in the
commits that follow. P1/P2 remain open.

## Scope and method

| Lane | Agent | Covered |
|------|-------|---------|
| A | `Next16PwaResearch` | Next 16 config/build/deploy, Vercel, metadata |
| B | `ServiceWorkerResearch` | `sw.js`, manifest, registration lifecycle |
| C | `ZustandReactResearch` | Zustand v5 persist/slices, React 19 lifecycle |
| D | `A11yI18nResearch` | WCAG 2.2, ARIA APG, i18n |

Guiding principle, taken from the repo's own `HARNESS.md`: **add configuration
only after an actual failure.** An audit that produces churn is a failed audit.
So the report is deliberately short on recommendations and explicit about what
is already right.

---

## 1. Confirmed defects, impact-ranked

### P0-1 — Vercel builds with pnpm 6, which cannot read this lockfile

`vercel.json:5` sets `"installCommand": "pnpm install"`. Vercel documents that an
override install command makes it use **the oldest version of that package
manager** in the build image — for pnpm, that is v6.

> "When using an override install command like `pnpm install`, Vercel will use
> the oldest version of the specified package manager available in the build
> container. For example, if you specify `pnpm install` as your override install
> command, Vercel will use pnpm 6."
> — https://vercel.com/docs/package-managers

Three things then compound:

| Fact | Value | Source |
|------|-------|--------|
| Lockfile format | `lockfileVersion: '9.0'` | `pnpm-lock.yaml:1` |
| pnpm 6 support for that format | none (pnpm 9/10) | Vercel lockfile table |
| `pnpm.overrides` entries | 17 | `package.json` (pnpm 7+ feature) |
| Pinned version | `pnpm@10.30.3` | `package.json:6` |
| Corepack enabled? | **no** — nothing in repo sets it | grep |
| `.npmrc` | `engine-strict=true` | `.npmrc:1` |

`packageManager` is inert without `ENABLE_EXPERIMENTAL_COREPACK=1`, and
`engine-strict` turns an install-time error into a confusing build-time crash.

**Fix**: delete the `installCommand` line. Vercel auto-detects pnpm from
`pnpm-lock.yaml` and resolves the right major. This is the opposite of the
current file. (If exact pinning is wanted, enable Corepack on the project.)

**Note**: `agents-docs/DEPLOYMENT.md:13` asserts "Vercel uses `packageManager`
field to install correct version". That is only true with Corepack on. The doc
and the config currently disagree.

### P0-2 — The service-worker registration deletes the precache it just wrote

**This is a regression introduced by Plan 157 (this repo, 2026-09-28).**

`service-worker-registration.tsx:92-108` deletes every cache whose name starts
with `dks-` when a new worker reaches `installed`. The new worker's own caches
are `dks-static-v2` / `dks-api-v2` (`sw.js:1-2`), so they always match.

Lifecycle order (`public/sw.js:49-73`):

```
install   → addAll(PRECACHE_URLS)  → skipWaiting()
installed →  ← PAGE-SIDE PURGE DELETES dks-static-v2 / dks-api-v2
activate  → allowlist keeps them (too late — already gone)
```

`sw.js`'s own `activate` handler is the correct place for this and already
does it with an allowlist. The page-side purge is both redundant and inverted:
the comment says it drops "the pre-cache it replaced" but it drops the *new*
one.

**Verified in Chromium** by replaying the exact filter:

```json
{ "before": ["dks-static-v2","dks-api-v2"],
  "deleted": ["dks-static-v2","dks-api-v2"],
  "appShellStillCached": false }
```

For a local-first app whose entire value proposition is surviving a dropped
connection, every deploy converts it to network-only until the user re-browses.

**Fix**: delete `service-worker-registration.tsx:89-110`. Cache lifecycle belongs
in `activate`, which is already correct.

### P0-3 — Hydration rejection is silent *and* destroys the data it preserves

Three findings that compound into one user-visible outcome.

**(a) Throwing from `merge` wedges the store.** `hydration.ts:186-188` throws
`HydrationRejectedError`; the same throw exists in `migratePersistedState`
(`:134-137`). Zustand's hydrate chain sets `hasHydrated = true` in the *second*
`.then`, which a throw from `merge` can never reach
(`zustand/esm/middleware.mjs:413-433`). The store stays flagged
not-hydrated for the life of the page. Zustand's persist docs give `merge` no
error semantics at all — the entire `## Troubleshooting` section is `TBD` —
and expose `onRehydrateStorage` for exactly this, which the repo never uses
(zero hits).

**(b) The preserved envelope is overwritten on the next write.** The code
comment claims the throw "aborts the post-migration `setItem`". True for that
one call; false for every later one. `api.setState` unconditionally calls
`setItem()` (`middleware.mjs:363-373`), and because the rejection left the
store holding seed state, the user's first interaction writes seed data over
their real corpus. Both tests in `store-persist.test.ts:87-115` assert the bytes
are intact *immediately after* `rehydrate()` and stop — the gap is invisible.

**(c) Nothing surfaces it.** `restoreFromRecovery` has no UI caller outside
tests, and it reads a different key than the rejected envelope. Net result: the
user sees a seed workspace, no error, no banner, no recovery affordance.

**Net user impact: silent, unrecoverable loss of the entire corpus.**

**Fix**: stop throwing out of `merge`; return current state and record the
rejection in `onRehydrateStorage`. Move the rejected envelope to a distinct key
so the next write cannot destroy it. Wire `restoreFromRecovery` to that flag in
`export-view.tsx`.

### P1-1 — `experimental.useTypeScriptCli: false` prints a build warning

`next.config.ts:33` makes every `pnpm run build` emit:

```
▲ Next.js 16.3.6 (Turbopack)
- Experiments (use with caution):
  ⨯ useTypeScriptCli
```

AGENTS.md: *"any output containing `⚠`, `warning`, `Warning` … must be addressed
immediately"*. By the repo's own rule this is already a defect. The underlying
intent is **legitimate and verified** — the API checker's
`regexIgnoredFile` really does filter `**/*.test.*` and `__tests__`, and the repo
keeps test sources intentionally loose. Only the mechanism is wrong.

Forward risk: `verify-typescript-setup.js:61-63` throws if the compiler API ever
disappears, telling you to set the flag back. A TypeScript 7 bump turns this
warning into a hard build failure.

**Fix**: remove the `experimental` block; point `typescript.tsconfigPath` at a
build config that excludes tests. *Caveat: `tsconfig.app.json` sets
`composite: true` and the CLI checker passes `--noEmit`, which historically
conflict — use a dedicated `tsconfig.build.json` without `composite`.*

### P1-2 — `vercel.json` sets two overrides Vercel tells you to delete

- `outputDirectory: ".next"` — Vercel's own error doc: *"If `outputDirectory`
  exists in `vercel.json`, remove that property"* (it is the leading cause of
  "Routes Manifest Could Not Be Found", and is only needed when you override
  `distDir`, which this repo does not).
- `installCommand` — see P0-1.

`framework: "nextjs"` is already set, so detection works; both lines opt out of
it for no benefit.

### P1-3 — Referrer policy is set twice, to two different values

`next.config.ts:46` sends `Referrer-Policy: strict-origin-when-cross-origin`;
`src/app/layout.tsx:42` sets `referrer: "no-referrer"`, emitted as a meta tag.
One document, two policies, and `headers()` applies to the precached HTML the
service worker serves offline. A maintainer reading either location alone draws
the wrong conclusion.

**Fix**: pick one. `no-referrer` matches the local-first/no-egress posture and
the rest of the header-based security config.

### P1-4 — Focus can be fully obscured by the sticky editor bars (WCAG 2.2)

SC **2.4.11 Focus Not Obscured (Minimum)** is new in WCAG 2.2, Level AA. W3C
documents this exact failure as technique **F110**: *"Failure of SC 2.4.11 due
to a sticky footer or header completely hiding focused elements."* The passing
technique C43 is CSS scroll padding.

`app-shell.tsx:165` is the scroll container with no scroll padding; the editor
has a sticky header (`editor-toolbar.tsx:55`, ~40px) and sticky footer
(`editor-hooks.tsx:261`, ~48px). Zero `scroll-padding`/`scroll-mt-`/`scroll-mb-`
anywhere in `src/`.

**Fix**: `scroll-pt-14 scroll-pb-20` on the scroll container. One-line.

### P2 — Medium-impact items

| # | Item | Evidence |
|---|------|----------|
| P2-1 | No `apple-touch-icon`, so iOS Add-to-Home-Screen uses a page screenshot. 192px non-transparent PNG already exists and is unreferenced. | `layout.tsx:37-39`; web.dev icons |
| P2-2 | `screenshots` absent from the manifest → Chrome shows the minimal infobar instead of the Richer Install bottomsheet. Does **not** affect installability. | Chrome richer-install doc |
| P2-3 | Precache is 4 hand-listed URLs; Turbopack's hashed `/_next/static/*` chunks are never precached, so a cold offline boot has no JS. | `sw.js:24-29` |
| P2-4 | `themeColor` is a single value in a class-based dark theme; add the documented media array. | Next `generateViewport` |
| P2-5 | `poweredByHeader` unset → every response advertises `x-powered-by: Next.js`, inconsistent with the curated CSP next to it. | Next config docs |
| P2-6 | Mind map `aria-selected` tracks DOM focus, not store selection — the tree reports the wrong selected item. | APG treeview |
| P2-7 | Mind map has `role="tree"`/`treeitem` but no `role="group"` and no `aria-level`, so every node announces at undifferentiated depth. | APG treeview |
| P2-8 | `engines.node: ">=20"` is below Next 16's hard floor of `>=20.9.0` (asserted in `bin/next:42-47`). Vercel maps `>=20.0.0` to latest 24.x, so **production is not currently at risk** — but a Node 20.5 dev machine passes install and then crashes the build. | Next 16 upgrade guide |
| P2-9 | Four `announce.*` keys are defined but never wired; `announce.libraryRestored` duplicates the wired `announce.storeReset`. | grep |
| P2-10 | Cross-tab sync attaches via a fire-and-forget dynamic `import()`, so it can subscribe *after* hydration and broadcast seed state over the recovered corpus to other tabs. Ordering is a TOCTOU gap, not a React one. | `store.ts:182-189` |
| P2-11 | `useStoreHydrated` is dead code; it is currently the only reason the P0-3(a) wedge is invisible. Decide: wire it properly or delete it. | grep |

---

## 2. Explicitly CORRECT — do not "fix" these

A naive 2026 audit regresses all of these. Recorded to prevent that.

- **44px target floor — do NOT downgrade to 24px.** 44px is WCAG 2.1
  **2.5.5 Target Size (Enhanced), Level AAA**; the AA bar 2.5.8 is only 24px.
  The app is *more* stringent than the level it is held to. AGENTS.md mandates
  44px deliberately.
- **Zustand selectors — do NOT migrate to `useShallow`.** All ~60 call sites
  use primitive or stable-by-reference selectors, and the codebase has already
  adopted the multiple-atom-subscription style (`library-view.tsx:150-164`).
  The classic v5 "Maximum update depth exceeded" regression is structurally
  impossible here.
- **`create<StudioState>()(persist(...))` is the correct v5 curried form** — not
  the pre-5.0 deprecated shape.
- **React 19 server primitives absent — correct for this app.** No Server
  Actions, no form actions, no API routes to attach them to. Adopting
  `useActionState` for its own sake would add a server round-trip and violate
  the stated local-first architecture.
- **React Compiler config is current.** `reactCompiler: true` top-level, and
  all three `'use no memo'` opt-outs sit on `@tanstack/react-virtual` consumers
  with comments citing the tracking issue — exactly what the official
  directives guidance asks for.
- **`StudioSlice<S>` is better than the official pattern.** The official
  `StateCreator<A & B, [], [], A>` cannot scale to 6 slices over a ~50-field
  store without every slice re-declaring the full intersection. *(One
  correction: the comment in `slice-types.ts:6-7` mis-states why — the real
  reason is the import-cycle problem, not that the 4th type param forbids
  partials. Comment-only fix.)*
- **The base two-arg `subscribe(state, prev)` in `cross-tab.ts` is correct.**
  It is a plain `Set.forEach` over vanilla listeners, outside React's rendering
  model, so no React 19 hazard applies. `subscribeWithSelector` is
  single-slice and cannot deliver the `(next, prev)` pair the diff needs.
- **`updateViaCache: "none"` is the highest-value hardening in the PWA layer.**
  Keep it. The `activate` allowlist in `sw.js` is the canonical cleanup pattern.
- **The manifest already satisfies every hard installability criterion.** A
  naive audit would either claim `screenshots` is now required (it is not) or
  add speculative fields like `display_override`.
- **`categories` is valid and has zero runtime effect** — it is distribution
  metadata for app stores, not browsers. Intentional; do not churn.
- **Unconditional `skipWaiting()` is correct today** (the SW holds no
  migration state). Add a comment warning that a future schema migration inside
  the SW makes it dangerous.
- **Do not add offline replay for AI calls** — the API key rides in an
  `Authorization` header; caching it would be a privacy leak. Offline AI
  requires the bundled in-browser model the repo already depends on.
- **Do not prune `'unsafe-eval'` from CSP.** Next.js says it is unnecessary in
  production, and that is true of the framework — but verified in the build
  output, the ONNX Runtime WebGPU bundle from `@huggingface/transformers`
  contains `new Function(...)`, which `script-src` governs. The directive is
  load-bearing. **Add a comment**, or a future hardening pass will silently
  break local AI embeddings.

---

## 3. Rejected after verification

Three findings from the research lanes did **not** survive. Recorded because
the reasoning is the reusable part.

| Claim | Verdict |
|-------|---------|
| AGENTS.md lacks the `nextjs-agent-rules` managed block the Next 16 upgrade guide requires (Lane A). | **Resolved during the audit.** `next dev` wrote the block into AGENTS.md while I was running the app. It is now staged for commit, which is what the guide asks for — otherwise it reappears as uncommitted churn on every dev-server start. |
| `role="img"` on the graph `<svg>` makes descendants presentational, so all 8 graph nodes are unreachable by AT (WAI-ARIA 1.2 "Children Presentational: True", MDN "browsers automatically apply role presentation to all descendant elements"). | **Not reproducible in Chrome.** Queried Chrome's real accessibility tree via CDP: all 8 nodes are exposed as `role=button` with their labels intact. The DOM has them *and* the AX tree has them. Worth re-testing in NVDA/JAWS before acting, but the spec-reading does not match current engine behaviour. |
| Compact density drops treeitem rows to ~22px, below WCAG 2.2 SC 2.5.8's 24px minimum. | **Disproven by measurement.** Computed in-browser: comfortable rows are 34px, compact rows 28px — both clear 24px. The static calculation missed that the `min-h-[44px]` chevron is a flex child in an `items-center` row and therefore raises the row height. |
| The `slice-types.ts` comment is factually wrong about `StateCreator`. | **Partially right.** The comment does mis-describe the official pattern's capability; the type itself is sound. Comment-only correction, not a refactor. |

The first two would both have been shipped as "fixes" on the strength of a
spec citation. Neither survived a five-minute browser check.

---

## 4. Remediation status

| Item | Status | Notes |
|------|--------|-------|
| P0-2 cache purge | **Fixed** | `service-worker-registration.tsx` no longer touches the cache or the worker lifecycle. Regression test replays the full `updatefound` → `installed` transition; verified to FAIL when the old code is reinstated. |
| P0-1 `installCommand` | **Fixed** | Removed. Vercel infers pnpm from `pnpm-lock.yaml`. |
| P1-2 `outputDirectory` | **Fixed** | Removed in the same change. |
| P0-3 hydration | **Fixed** | New `hydration-quarantine.ts` preserves a refused payload under a key the store never writes. A `QuarantineBanner` surfaces it. Test proves the bytes survive a subsequent `saveEntity`. |
| P1-3 referrer policy | **Fixed** | Collapsed to the header (`no-referrer`); the conflicting `metadata.referrer` is gone. Verified in-browser. |
| P1-4 focus obscured | **Fixed** | The audit's prescribed remedy was wrong — see below. |
| P1-1 build warning | **Fixed** | `tsconfig.build.json` + `typescript.tsconfigPath`. See below. |
| P2-1, P2-4, P2-5, P2-6, P2-7, P2-8, P2-9 | **Fixed** | See below. |
| P2-2 manifest screenshots | **Fixed** | Real captures at both form factors, wired into the manifest and the precache list. |
| P2-3 precache | **Fixed** | Generated manifest derived from the emitted HTML; verified offline in Chromium (#838). |
| P2-10 cross-tab ordering | **Fixed** | The broadcast subscription now waits for `onFinishHydration`. |
| P2-11 dead `useStoreHydrated` | **Fixed** | Deleted — `app-shell.tsx`'s `appReady` already serves the E2E readiness contract, and a second signal could not express the refusal path. |

### P1-4: the prescribed fix did not work

The audit recommended W3C technique C43 (`scroll-padding`) on the app-shell
scroll container. **Measured, that does not fix it.** The editor status bar is
`position: sticky; bottom: 0` *inside* the scrolled content, so at maximum
scroll it permanently overlays the final ~69px. `scroll-padding` only
influences where the browser positions an element it is actively scrolling
into view; an element already in view is never scrolled, and one at the end
of the content cannot be moved at all. Verified: with `scroll-pt-16
scroll-pb-20` applied, a control was still 100% covered at `scrollTop` max.

The actual fix is bottom padding on the editor's content wrapper (`pb-24` /
`lg:pb-28`) so the last row can always be scrolled clear. Re-measured after the
change: **0 of 19** content controls entirely hidden, down from 1.

The audit's *diagnosis* — a real SC 2.4.11 failure — was right; its *remedy*
was wrong. Recorded because a well-sourced fix that does not survive contact
with the layout is an easy error to repeat.

### P1-1: removing the build warning without giving up type safety

`experimental.useTypeScriptCli: false` existed to stop the build's typecheck
from failing on the repo's 94 intentionally-loose test sources. Removing it
naively would surface all 94 and break the build.

The flag was the wrong instrument for two reasons beyond the warning banner:
Next's own upgrade guide says the compiler-API path it selects is exactly what
breaks when TypeScript 7 drops that API, and `verify-typescript-setup.js`
throws on build if the API is ever absent. So the flag was on borrowed time.

The fix keeps the **CLI** checker (the future-proof one) and narrows its scope
with `typescript.tsconfigPath` pointing at a new `tsconfig.build.json` that
excludes test sources. Measured:

| | Result |
|---|---|
| Type errors in the repo | 94, **all** in test files |
| Type errors under `tsconfig.app.json` | 0 |
| `Experiments (use with caution)` banner | gone |
| Build still typechecks app code | verified by injecting a deliberate `TS2322` — the build caught it |

The audit's caveat that `composite: true` conflicts with the CLI checker's
`--noEmit` turned out to be over-cautious: `runTypeCheckCli.js` reads
`composite` to decide whether to pass `--tsBuildInfoFile`, and explicitly
overrides `--emitDeclarationOnly`. A dedicated config without `composite` is
still the cleaner shape — it keeps build-typecheck and `pnpm typecheck` from
drifting — but the conflict was not real.

Three older plans (142, 143, 144) recorded this notice as "pre-existing and
deliberate". It was tolerated rather than justified, and the repo's own
zero-warning rule makes it a defect.

### Two zustand constraints worth recording

Both were found the hard way and are commented at the call site:

1. **`migrate` must return the bare state, not a wrapper.** Its return value
   is passed straight into `merge`, so returning `{ok, state}` hands `merge` a
   shape the envelope schema rejects — every migration silently fails.
2. **Zustand treats *any* non-Promise return from `migrate` as "migrated" and
   calls `setItem()`.** The original `throw` therefore could not preserve
   anything: the next store write overwrote the envelope regardless. The
   refusal path returns the input unchanged, which makes the rewrite a no-op,
   and the bytes are kept in a separate key.

## 5. Still open

**Nothing.** Every item in this audit is closed, verified against the current
tree rather than inferred from when each was written.

| Group | Resolution |
|-------|------------|
| P0-1, P0-2, P0-3 | Vercel config, service-worker cache purge, hydration quarantine |
| P1-1..P1-4 | Build tsconfig, `outputDirectory`, referrer policy, focus obscuring |
| P2-1..P2-11 | apple-touch-icon, screenshots, precache, themeColor, poweredByHeader, tree ARIA, engines floor, announce keys, cross-tab ordering, dead `useStoreHydrated` |

One finding that turned out not to be a finding: Plan 131 W2 tracked "~26
prunable dependencies" as an estimate rather than a measurement. A scan of all
63 found only 4 with no import in `src/`, `e2e/`, or `scripts/` — and all four
are required (`react-dom` and `sharp` are Next 16 peer/optional requirements,
`tw-animate-css` is imported by `globals.css`). There is nothing to prune.
