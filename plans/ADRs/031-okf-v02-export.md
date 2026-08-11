# ADR 031: Native Open Knowledge Format (OKF) v0.2 Bundle Export/Import Support

## Status
Proposed/Approved — Native OKF v0.2 support implemented with bundle export/import pipelines, Zod validator definitions, and trust/staleness utilities.

## Context
Google Cloud Platform announced OKF v0.2 (2026-07-24): a vendor-neutral format representing knowledge as structured directory trees of Markdown files with YAML frontmatter.

The studio previously exported markdown but concatenated all entities into a single non-standard file, and lacked a corresponding round-trip import pipeline. This created a validation/persistence gap as highlighted in ADR 010.

OKF v0.2 provides:
- Agent-readable directory bundles needing zero custom SDK.
- Trust, provenance, verification, and freshness metadata.
- A well-governed schema that enables clean export/import round-tripping.

## Decision
We implement first-class native OKF v0.2 bundle import/export support in `src/lib/okf/`:
1. **`src/lib/okf/types.ts`**: Zod schemas representing OKF v0.2 entities, sources (provenance), verifiers (trust events), and attested computations with passthrough support.
2. **`src/lib/okf/bundle.ts`**: Export engine converting internal studio entities, claims, and graph relationships into a zipped OKF v0.2 bundle containing concept Markdown documents, an `index.md`, and a date-grouped `log.md`.
3. **`src/lib/okf/import.ts`**: Import engine reconstructing studio entities and claims from zipped OKF bundles. Follows the Conformance §11 rule: must not reject unknown types/keys, broken links, or missing optional fields.
4. **`src/lib/okf/trust.ts`**: Helper to derive trust tiers ('unverified', 'machine-confirmed', 'human-reviewed') and evaluate staleness (`isStale`).

### Export Format Integration
We register `'okf'` as a native format in `export-types.ts` and update `use-export-handlers.ts` to sync with client-side zip creation/extraction via `fflate`.

## Consequences

### Positive
- Fully closes the Markdown round-trip gap identified in ADR 010.
- Adds standard-compliant trust, provenance, and update-log tracking.
- Makes exported data immediately consumable by OKF-aware agents without requiring an SDK.

### Negative
- Minor maintenance cost of OKF parser and bundle logic in `src/lib/okf/`.
- Introduces `fflate` as a direct runtime dependency for ZIP generation/extraction.
