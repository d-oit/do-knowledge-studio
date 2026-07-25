# ADR 018 — Next.js Architecture Baseline & Backend Decision

**Date**: 2026-07-09
**Status**: Implemented — Next.js 16 / React 19 is the production architecture baseline.
**Supersedes**: implicit assumptions in ADR 001 (SQLite WASM) and the Vite-era
Repository Shape in AGENTS.md

## Context

Commit `4303290` replaced the original Vite + React SPA (SQLite WASM + OPFS +
Orama) with a **Next.js 16 / React 19** app. The live app is a single-shell SPA
(`src/app/page.tsx` → `AppShell`) whose state lives in **Zustand with
`localStorage` persistence** (`src/lib/studio/store.ts`). There is no SQLite, no
OPFS, and no Orama.

Two backend-shaped dependencies remain but are **unused** (see plan 048):
- `next-auth` — zero references anywhere.
- Prisma (`@prisma/client`, `prisma/schema.prisma`, `db:*` scripts,
  `postinstall: prisma generate`) — referenced only by `src/lib/db.ts`, which
  nothing imports.

This contradicts the README ("no backend required") and the AGENTS.md hard rule
"Local-first only. Do not introduce a required backend."

## Decision

Adopt **local-first, no required backend** as the confirmed baseline for the
Next.js app:

1. Persistence layer is **Zustand + `localStorage`** (single namespaced JSON
   blob `do-knowledge-studio-store`). SQLite/OPFS are not part of this
   architecture; ADR 001 applies to the retired Vite SPA only.
2. **Remove** the unused backend stack: `next-auth`, `prisma`,
   `@prisma/client`, `src/lib/db.ts`, `prisma/schema.prisma`, the `db:*`
   scripts, and the `postinstall` hook.
3. Any future backend (accounts, server sync) requires a **new ADR** that
   explicitly reverses the "no required backend" rule and defines the trust and
   offline-fallback model. Multi-device sync (GOAP action N3) must remain
   **opt-in** and degrade gracefully offline.

## Consequences

- Faster installs (no `prisma generate` on every install); smaller dependency
  and attack surface.
- README/AGENTS.md/CLAUDE/GEMINI/QWEN must be updated to the Next.js stack and
  the localStorage persistence model (plan 048 items #4–#5).
- The `links`/`claims` graph and search all operate in-browser over the
  localStorage dataset — see ADR 022.

## Alternatives Considered

1. **Keep Prisma "for later."** Rejected: dead code that misleads contributors
   and breaks the local-first contract; cheap to re-add behind a future ADR.
2. **Add a backend now.** Rejected: no product requirement; would invalidate the
   offline-first value proposition without a decision to do so.
