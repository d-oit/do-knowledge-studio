# ADR 035: Global Error Handling and Client-Side Logging

## Status

Proposed — implemented via Plan 130
(`plans/130-goap-uiux-testpyramid-errorhandling-2026-08-22.md`).

## Context

Audit of 2026-08-22 (Plan 130) found the error-handling stack strong at
the component layer but missing the framework and runtime layers:

**What exists (keep):**

- `AppError` class with `ErrorCode` enum and `USER_MESSAGES` map
  (`src/lib/errors.ts`) — machine-readable codes + user-friendly text
  (ADR 005 → superseded patterns consolidated by ADR 028).
- `ViewErrorBoundary` per view with `componentDidCatch → onError`
  (`src/components/studio/view-error-boundary.tsx`) wired in
  `app-shell.tsx:77`.
- Generic `ErrorBoundary` (`src/components/studio/error-boundary.tsx`)
  as outermost fallback.

**What is missing:**

1. **No Next.js App Router error files.** `src/app/` contains only
   `layout.tsx`, `page.tsx`, `globals.css`, and `api/route.ts`. There
   is no `error.tsx`, no `global-error.tsx`, no `not-found.tsx`, and no
   Next.js 16 `global-not-found.tsx`. Per the Next.js official error
   handling convention:
   - `error.tsx` catches render errors for its route segment; it must
     be a client component receiving `{ error, reset }`, log in a
     `useEffect` (not during render), and offer a recovery path via
     `reset()`. Production replaces server-side messages with an
     opaque `error.digest` — client code must surface the digest, not
     rely on `error.message`.
   - `global-error.tsx` catches failures in the root layout itself,
     replaces the entire document (must render its own `<html>` /
     `<body>`), and only activates in production.
   - `not-found.tsx` handles `notFound()` control-flow results with a
     real 404 status.
   - `global-not-found.tsx` (Next 16) handles URLs matching no route.
2. **No global runtime handlers.** No `window.addEventListener`
   wiring for `unhandledrejection` or `error` anywhere in `src/`.
   Uncaught async rejections vanish silently.
3. **No logging abstraction.** 31 scattered `console.*` call sites
   (store migrations, AI settings, draft storage, sync discovery,
   speech, service worker) with inconsistent formats, no levels, no
   context tags, no serialization discipline, and no way to correlate
   a boundary catch with its preceding warnings.

Constraints: local-first, no required backend (AGENTS.md hard rule);
zero new runtime dependencies preferred; strict TypeScript.

## Decision

### Layered error handling

Adopt the full Next.js App Router error-file set on top of — not
instead of — the existing boundaries:

- `src/app/global-not-found.tsx` — unmatched URLs (Next 16
  convention).
- `src/app/not-found.tsx` — `notFound()` results, styled to design
  tokens.
- `src/app/error.tsx` — root-segment render errors; receives
  `{ error, reset }`; logs via logger in `useEffect`; shows
  `error.digest` when present.
- `src/app/global-error.tsx` — root-layout failure; renders its own
  `<html>/<body>`, minimal token-free markup, reset button.

The existing `ViewErrorBoundary` remains the primary user-facing
recovery surface per view; the new files are the safety net above it.

### Zero-dependency structured logger facade

New module `src/lib/logging/logger.ts`:

- **Levels**: `debug | info | warn | error` (default `info`;
  `debug` when `process.env.NODE_ENV !== 'production'`).
- **Context tags**: `logger.child({ area: 'store' })` style — each
  migrated call site logs with its subsystem tag.
- **Structured entries**: `{ timestamp (ISO), level, area, message,
  data? }` — plain objects, never string interpolation of objects.
- **Sinks**: console sink (dev-formatted) + bounded in-memory ring
  buffer sink (last N entries) exposed for a future diagnostics export
  in the app UI. No network sink ships by default — honoring the
  local-first rule; a `LogSink` interface exists so an opt-in remote
  transport can be added later without touching call sites.
- **Redaction discipline**: log messages and codes, never API keys or
  entity content blobs (AGENTS.md security rules).

### Migration

All 31 `console.*` sites move to the logger with subsystem context
tags. `console.error` in boundary callbacks becomes
`logger.error(...)` including the view name already provided to
`ViewErrorBoundary`.

### Global runtime handlers

A small client provider (mounted once in `app-shell`) registers
`unhandledrejection` and `error` listeners that route into the logger
as `error` level with `area: 'global'`, deduplicated per message to
avoid storms. Handlers are registered in an effect and cleaned up on
unmount.

## Consequences

- Every uncaught failure lands in one queryable stream (console +
  ring buffer); support/diagnosis no longer depends on reproducing.
- Framework-level crashes stop showing the default Next error page;
  users always get a themed, actionable screen.
- The ring buffer enables a future "export diagnostics" feature
  without any backend.
- Migration touches many files mechanically but adds no dependencies
  and no bundle-weight risk (~100 LOC logger).
- Tests: unit coverage for the logger (levels, tags, ring buffer,
  redaction-safe serialization) plus E2E specs asserting the boundary
  recovery UX renders and recovers.
