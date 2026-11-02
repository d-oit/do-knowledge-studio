# Plan 193 — Reconcile license, version and repo-description metadata (2026-11-02)

Closes #1049. Public metadata disagreed with itself: the README called the
project "Internal" while `LICENSE` and the GitHub sidebar said MIT, the
copyright line still named the template's placeholder holder, `VERSION` and
`package.json` carried different versions, and a leftover `/api` route
contradicted the "zero required backend" claim.

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Make README, `LICENSE` and `NOTICE` agree on MIT and the real owner | Done | README license section says MIT; `LICENSE`/`NOTICE` name Dominik Oswald (2026) |
| 2 | Pick one version source of truth | Done | `package.json` is canonical; `propagate-version.sh` writes `VERSION` and the derived docs |
| 3 | Remove the leftover `/api` route and its dead cache policy | Done | Route deleted; the service worker no longer keeps an API cache |
| 4 | Make the invariants fail CI | Done | `docs:check` fails on `VERSION` drift, a non-MIT README/LICENSE/NOTICE, or the template holder |

## Wave 1 — license truth

`LICENSE` and the GitHub sidebar already said MIT, so the README was the
outlier. The copyright holder is the maintainer, and the repository's first
commit is 2026-04-14, so the year is 2026 rather than the template's 2025.
`NOTICE` carried the same template-era header and holder.

## Wave 2 — one version source

`package.json` is what `pnpm version` and npm tooling read, so it is the source
of truth. `scripts/propagate-version.sh` now reads `version` from it, validates
`X.Y.Z`, writes the root `VERSION` mirror, and then updates
`agents-docs/VERSION.md`, `agents-docs/MIGRATION.md` and the README badge.
`VERSION` was realigned from `0.1.2` to `0.2.0`.

## Wave 3 — the `/api` route

`src/app/api/route.ts` returned a static `{status:"ok"}` and had no consumer:
no workflow, Vercel config, or test called it. It was a template leftover, so it
was deleted. The service worker's `dks-api-v2` cache and its `/api` allowlist
existed only to cache that route; both were removed, and the default
network pass-through (no caching) now covers every non-navigation,
non-static request. `docs/CACHE_INVENTORY.md` and the PWA tests were updated to
match.

## Wave 4 — CI invariants

`scripts/check-doc-consistency.mjs` now fails when:

- `VERSION` differs from `package.json` `version`;
- the README license section is missing, does not say MIT, or says "Internal";
- `LICENSE` is not the MIT text or `NOTICE` does not state MIT;
- `LICENSE` or `NOTICE` still names "AI Agent Template Contributors".

Each check was verified to fail on an injected violation and pass when restored.

## Verification

- `pnpm run docs:check` — pass, and fails on each injected violation.
- `npx bats tests/propagate-version.bats` — 6/6 pass.
- `pnpm run typecheck`, `pnpm run lint` — pass.
- `pnpm exec vitest run` — 232 files pass, 1 skipped.
- `pnpm run build` — pass.

## Out of scope

GitHub repository topics (`local-first`, `crdt`, `pwa`, `nextjs`) need a
maintainer action: the brokered GitHub App token cannot update repository
metadata (`PATCH /repos` returns 403). The About description already no longer
mentions SQLite FTS5.
