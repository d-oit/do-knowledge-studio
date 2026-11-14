---
name: validation-checklist
description: Validate data at this app's real boundaries - IndexedDB and localStorage rehydration, file import, sync payloads, AI provider responses, and MCP input - with Zod, meaningful errors, and referential integrity. Trigger when adding a persisted field, a migration, an import/export format, a sync message, or any code that parses external or stored JSON.
version: 1.0.0
---

# Validation checklist

This is a local-first app: the dangerous boundaries are the ones where bytes
come back from storage, a file, a peer, or a model. There is no API server and
no database, so "validate at the API boundary" is not the rule here.

## Boundaries that need a schema

| Boundary | Schema / helper |
|---|---|
| Entity and claim shape | `src/lib/studio/schema.ts` |
| localStorage rehydration | `src/lib/studio/hydration-quarantine.ts`, `hydration-guard.ts` |
| IndexedDB corpus read | `src/lib/studio/canonical-storage.ts` |
| Recovery snapshots | `src/lib/studio/recovery-helpers.ts` |
| File import (JSON, Markdown, vault) | `src/components/studio/views/export-helpers.ts`, `src/lib/import/` |
| Sync inbound records | `src/lib/sync/inbound.ts` (`validateInboundEntity`, `validateInboundClaim`) |
| Sync file bundles | `src/lib/sync/file-bundle.ts` |
| AI provider responses | `src/lib/ai/providers.ts`, `src/lib/synthesis/schema.ts` |
| OKF bundle / MCP bridge | `src/lib/okf/` (`bundle.ts`, `import.ts`, `trust.ts`) |

## Rules

1. **Parse, do not cast.** `JSON.parse` returns `unknown`. Run it through a Zod
   schema and branch on `safeParse`. A type assertion on parsed JSON is a bug.
2. **Reject unknown versions.** A persisted or imported payload carries a
   version. An unsupported version is an error with a specific message, never a
   silent default to the current shape.
3. **Fail visibly.** Every validation failure is logged with `console.error` or
   surfaced as a toast with a localized message. No empty `catch {}` blocks and
   no swallowed `safeParse` results.
4. **Quarantine, do not delete.** Corrupt stored data goes to the quarantine
   path so the user can recover it. Never drop a record because it failed
   validation.
5. **Keep referential integrity.** A link, graph edge, mind-map node or claim
   must not point at a deleted entity. Reuse the deletion-consistency helpers
   rather than writing a new cascade.
6. **Sanitize rendered output.** Markdown and HTML from imports or models is
   sanitized before rendering; never inject it as raw HTML.
7. **Bound the input.** Size limits and record counts are named constants, and
   they are checked before parsing, not after.

## Verification

- Add a test next to the changed logic that feeds malformed, truncated and
  wrong-version input.
- Re-inject the defect and watch the test fail before restoring it
  (LESSON-041) — a test you have not seen fail is not evidence.
