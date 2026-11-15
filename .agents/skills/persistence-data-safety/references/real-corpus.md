# Real-Corpus Verification

How to prove a persistence change against data shaped like production,
in a real browser. Unit tests use toy stores; data-loss bugs hide in
scale, interleaving, and interrupted writes.

## Build a fixture corpus

- Preferred: anonymized production export. Import the JSON backup through
  the app import flow, not by writing IndexedDB directly — the import path
  is part of what you are verifying.
- Fallback: generate one. Seed several hundred entities with claims, links,
  attachments metadata, and saved searches so migrations and indexes have
  something to chew on. Vary field presence: missing optional fields,
  empty arrays, and unicode titles catch canonicalization bugs.
- Record corpus stats in `plans/`: entity count, claim count, export size.

## Fingerprint before and after

```bash
# example - not in this repo
node scripts/corpus-fingerprint.mjs before.json > before.sha
# ... run the scenario, export again ...
node scripts/corpus-fingerprint.mjs --expect "$(cut -d' ' -f1 before.sha)" after.json
```

Key order and whitespace do not affect the hash; array order does. A
mismatch after a pure reload means non-deterministic serialization — treat
it as a bug, not noise. Record both hashes in `plans/`.

## Drive it in a real browser

Use `agent-browser` (or Playwright) against the running app:

1. Load the corpus, fingerprint the export.
2. Reload the page; fingerprint again — must match.
3. Kill the tab mid-write (close during a large save, throttle CPU 6x to
   widen the window), reopen, and confirm the recovery snapshot restores
   with no silent loss — quarantine entries are acceptable, missing
   entities are not.
4. Open two tabs, edit the same entity in both, close one, reload the
   other, and confirm the merge (tombstones win, nothing resurrects).
5. Undo and redo the last three operations after reload.

## Export/import round trip

Export, wipe the corpus (fresh profile), import, fingerprint. The hash must
match the pre-wipe export. Version the export (`EXPORT_SCHEMA_VERSION`);
an import of a newer version must fail loudly, never coerce silently.
