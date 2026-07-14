# ADR 023 — Editor Draft Persistence and Commit Lifecycle

**Date**: 2026-07-12
**Status**: Proposed
**Related**: ADR 018, ADR 020, ADR 024,
`plans/053-goap-markdown-editor-ux-2026-07-12.md`

## Context

The editor currently keeps all fields in component state. Refresh, navigation,
or remount can lose work. `saveEntity` combines three responsibilities: it
upserts an entity, clears `editingEntityId`, and navigates to Library. A first
save would therefore remount the editor if the application tried to stay in
place. Dirty detection covers name, content, type, and description but omits
tags and source URL.

Persisting every keystroke directly into the canonical entity is also unsafe.
New or temporarily invalid drafts may lack a name, and high-frequency writes to
the existing single Zustand persistence blob would repeatedly serialize
entities, claims, chat, and unrelated UI state.

## Decision

Separate **recovery drafts**, **canonical commits**, and **navigation**.

### Draft model and ownership

1. Add a versioned, Zod-validated `EditorDraft` boundary containing:
   - stable `draftId` and optional `entityId`;
   - all editable fields: name, type, description, content, tags, source URL,
     and links when link editing is introduced;
   - `baseUpdatedAt` or equivalent committed revision;
   - monotonically increasing draft revision and last persisted revision;
   - draft creation and modification timestamps.
2. Recovery drafts are noncanonical and use a dedicated persistence key, such
   as `do-knowledge-studio-editor-drafts`, rather than the main store blob.
3. Persist the active draft ID so refresh restores the intended session,
   including an unnamed new entity.
4. Invalid or unknown persisted data is quarantined or discarded with a
   recoverable error; it is never cast through unchecked hydration.

### Persistence and commit

1. Persist a recovery draft after a named debounce interval. The adapter must
   report completion or failure of the actual storage write; a Zustand memory
   update alone is not “saved.”
2. Flush pending draft writes at controlled boundaries: entity switch, start
   new, app navigation, component unmount, `visibilitychange` to hidden, and
   `pagehide`. Do not rely on `beforeunload`.
3. `Cmd/Ctrl+S` and the Save button invoke the same canonical commit operation.
   They flush the recovery draft first, validate and normalize the entity, then
   upsert it without navigating away.
4. Validation failure keeps the recovery draft, focuses the first invalid
   field, and reports the problem inline.
5. A successful first commit establishes `entityId` without remounting the
   editor or losing focus, selection, undo history, or status.
6. Canonical commit, `finishEditing`, and navigation are separate store actions.
7. Clear a recovery draft only after acknowledged canonical commit or explicit
   discard. Never clear it optimistically.

### Status model

Do not use one `clean | dirty | saving | saved | error` enum. Track two facts:

- whether the current draft differs from the committed baseline; and
- whether the latest draft revision reached durable storage.

Derive human-facing statuses such as “Unsaved changes,” “Saving draft…,”
“Draft saved locally,” “Entity saved,” and “Could not save draft.” A synchronous
write may skip a visible saving phase; no artificial delay is added.

### Conflicts, discard, and destructive boundaries

1. If `baseUpdatedAt` no longer matches the entity, preserve the draft and offer
   compare/keep-mine/reload-latest choices. Never silently overwrite.
2. Listen for relevant `storage` events so two tabs can detect an external
   commit. Full collaborative merging is out of scope.
3. Import, reset, and delete flows must enumerate affected drafts and request a
   deliberate resolution before destroying recoverable work.
4. Navigation does not need a confirmation when the latest draft revision is
   durably stored. If persistence failed, navigation exposes the risk and offers
   retry, copy Markdown, or explicit discard.
5. Claims remain independently committed records. Entity draft status must not
   imply that claim changes are staged with the entity.

## Consequences

- Refresh and ordinary navigation no longer threaten editor work.
- Canonical entities remain valid and are not polluted by partial drafts.
- The main persistence blob avoids high-frequency whole-application writes.
- Store actions become clearer but require a migration from the current
  navigation-coupled `saveEntity` contract.
- Conflict detection is explicit; automatic multi-tab merging remains out of
  scope.

## Relationship to ADR 018

ADR 018 remains correct that Zustand plus localStorage is the persistence
architecture. This ADR narrows the “single namespaced JSON blob” detail by
allowing a dedicated, versioned editor-draft key for write isolation and
recovery safety. No backend is introduced.

## Alternatives considered

1. **Commit every keystroke to `entities`.** Rejected because invalid new drafts,
   updated timestamps, library ordering, and conflict semantics become coupled
   to typing.
2. **Keep drafts only in React state.** Rejected because refresh and navigation
   lose work.
3. **Persist drafts in the main Zustand blob.** Rejected because it serializes
   unrelated durable data on the editor debounce cadence.
4. **Warn on every navigation.** Rejected because acknowledged local draft
   persistence makes routine confirmation unnecessary.
