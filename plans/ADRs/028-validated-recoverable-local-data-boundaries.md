# ADR 028 — Validated and Recoverable Local Data Boundaries

**Date**: 2026-07-19  
**Status**: Accepted  
**Related**: ADR 010, ADR 018, Plan 071

## Context

The studio is local-first, so browser persistence and user-controlled export
files are the durability boundary. Current implementation has two unsafe paths:

1. persisted Zustand hydration trusts unknown data through a no-op migration
   cast;
2. JSON import uses shallow guards, silently filters invalid records, and then
   immediately replaces canonical entities and claims.

Complete Zod schemas already exist for core records. The missing decision is how
strictly to validate, what to do with partially invalid data, and how users
recover from destructive replacement.

## Decision

### 1. Validate every external state boundary

The following inputs are untrusted and must be parsed with versioned Zod
schemas before they can mutate canonical state:

- `localStorage` hydration;
- JSON and encrypted archive import;
- future Markdown import metadata;
- Yjs/peer projections;
- AI/provider and web-research responses where persisted.

Type assertions and shallow record filters do not satisfy this boundary.

### 2. Imports are atomic and fail closed

An import payload is accepted only when its declared version is supported and
all records and references required by that version are valid. Invalid records
are not silently dropped. Parsing produces either:

- a complete validated candidate plus a preview summary; or
- a structured error list with record paths and no state mutation.

Best-effort salvage is a separate explicit recovery workflow, never the default
import behavior.

### 3. Replacement requires preview and recovery

Before replacement, the UI shows entity/claim/link counts, detected conflicts,
schema version, and the consequence that current data will be replaced. A
validated pre-import snapshot is created before canonical commit.

Replacement is one atomic store transaction. If commit or persistence fails,
the previous snapshot is restored. The user can also explicitly undo the most
recent replacement until a later destructive operation supersedes that
recovery point.

### 4. Hydration uses versioned migrations

Persisted state has an explicit schema version and a migration chain. Hydration:

1. reads the raw persisted envelope;
2. validates the envelope/version;
3. applies known migrations sequentially;
4. validates the resulting current schema;
5. hydrates canonical state atomically.

If recovery is possible, valid data is exposed through an explicit recovery
path. Unknown future versions or unrecoverable corruption do not enter the
store. The application offers reset and raw-export options without logging
personal content.

### 5. Referential integrity is part of validation

- Claims must reference an imported/existing entity according to import mode.
- Entity links must target a valid entity unless the schema explicitly permits
  external references.
- IDs are unique within each collection.
- dates, enums, confidence ranges, and version fields are validated.
- deletion removes or resolves dependent links and claims atomically.

## Consequences

### Positive

- Malformed archives cannot silently destroy valid local data.
- Schema evolution is explicit and testable.
- Import errors can identify exact invalid paths.
- Sync and hydration can reuse the same canonical validators.
- Recovery behavior matches the importance of local-only user data.

### Negative

- Strict import rejects partially useful legacy files until a dedicated
  recovery tool exists.
- Snapshot retention consumes temporary local storage.
- Migration and rollback tests become mandatory for every persisted schema
  change.
- Import UI gains a preview/confirmation step.

## Alternatives Considered

1. **Continue filtering invalid records.** Rejected: silent data loss is worse
   than an actionable failed import.
2. **Validate only TypeScript shapes.** Rejected: TypeScript types do not exist
   at runtime.
3. **Always merge imports into current data.** Rejected as a default: ID,
   deletion, and relationship conflicts need explicit semantics.
4. **Keep an automatic JSON stringify clone as backup.** Rejected: use a
   validated snapshot and `structuredClone` for in-memory copies.
5. **Reset automatically on hydration failure.** Rejected: local-first data
   should not disappear without an explicit recovery choice.

## Implementation Requirements

- Define the current persisted-state envelope schema next to canonical record
  schemas.
- Reuse schemas for export, import, hydration, and sync boundaries.
- Reject unsupported versions before reading records.
- Build preview data from the validated candidate only.
- Add one atomic replacement action and one bounded recovery snapshot.
- Keep raw recovery export local; never log user content or secrets.

## Verification

- Invalid field, enum, date, confidence, duplicate ID, dangling relation, and
  unsupported-version fixtures leave canonical state byte-for-byte unchanged.
- Valid export/import round-trip preserves all supported canonical data.
- A forced persistence failure restores the prior snapshot.
- Known old persisted versions migrate deterministically and idempotently.
- Unknown future and corrupt persisted versions present recovery choices.
- Entity deletion removes dependent claims and incoming/outgoing links in one
  undoable transaction.
