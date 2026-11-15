---
version: "1.0.0"
name: persistence-data-safety
description: "Verify storage, hydration, migration and sync changes against a real corpus in a real browser: shadow fingerprints, quarantine, cross-tab, undo/redo and export round trip."
category: workflow
---

# Persistence Data Safety

Purpose: make persistence changes survive production. Unit tests prove the
function; only a real corpus in a real browser proves the data is safe.

## When to run

Any change under these paths, before it merges:

- `src/lib/studio/canonical-storage*.ts` (IndexedDB corpus)
- `src/lib/studio/hydration*.ts` (guard, quarantine, rehydrate)
- `src/lib/studio/recovery-*.ts` (snapshots, recovery)
- `src/lib/studio/migrations*.ts`, `src/lib/studio/schema.ts`
- `src/lib/studio/cross-tab*.ts`, `src/lib/sync/**`
- `src/lib/studio/slices/**` when the change alters stored shape

## Required stages

Follow `agents-docs/DELIVERY-LIFECYCLE.md`. For this skill the non-skippable
stages are:

1. **Reproduce first.** A data-loss fix starts from a failing demonstration
   against `production` data shape, not from the patch.
2. **Evaluate.** Schema version bump plus migration plus property test for
   any stored-shape change (`migrations*.test.ts` pattern).
3. **Adversarial.** Kill the tab mid-write; reload with a corrupt snapshot;
   open two tabs and interleave writes. Each must land in quarantine or
   merge — never silent loss.
4. **Shadow.** Fingerprint the corpus before and after with
   `scripts/corpus-fingerprint.mjs`; record both hashes in `plans/`.
5. **Canary before promote.** Real browser, real corpus, reload, compare.

## Checklist

- [ ] Stored-shape change ships a schema version bump plus a migration.
- [ ] Migration has a property test (round trip old shape to new shape).
- [ ] Unknown future fields route through the hydration guard to quarantine,
      never into the canonical corpus.
- [ ] Recovery snapshots are written before destructive operations and the
      quarantine copy is restorable (see `recovery-helpers.ts`).
- [ ] Cross-tab writes merge (tombstones win, no resurrection, no duplex
      loss) — see `cross-tab-merge.ts`.
- [ ] Undo/redo still inverts the operation after the change.
- [ ] Export/import round trip preserves the corpus (fingerprint before and
      after import matches).
- [ ] Shadow fingerprints recorded in `plans/`; mismatch investigated, never
      waved through.

## Real-corpus verification

How to build or load a large fixture corpus and drive it in a real browser
lives in `references/real-corpus.md`. The short version: seed or import a
corpus of realistic size, fingerprint it, perform the scenario (migration,
kill mid-write, two-tab edit), fingerprint again, and diff.

## Related

- `testing-strategy` — suite design; `test-runner` — running suites.
- `pwa-offline-sync` — service worker and sync-queue mechanics.
- `agent-browser`, `dogfood` — real-browser evidence.
