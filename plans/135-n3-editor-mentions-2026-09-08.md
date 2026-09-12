# Plan 135 — N3: @mention entity linking in the editor (issue #753)

**Date**: 2026-09-08
**Owner**: N3Mentions (workstream within the N1–N7 swarm)
**Scope**: `editor-view.tsx`, `editor-mention-picker.tsx`, `src/lib/editor/mention.ts`,
`src/lib/i18n/messages/mentions.ts`, tests, `e2e/editor-mentions.spec.ts`.

## Token convention (DECISION)

Mentions are stored inline as **plain markdown links with a reserved URI scheme**:

```
[@Entity Name](dks://entity/<id>)
```

- The raw textarea stays editable markdown — no hidden ranges/proxies.
- `react-markdown` renders the link; the editor preview supplies a custom `a`
  component that styles `dks://entity/…` links as saffron chips
  (`data-mention-id` for tests/automation) and renders every other link as a
  normal external anchor.
- Machine-parseable with a single regex
  (`/\[@([^\]]+)\]\(dks:\/\/entity\/([^)]+)\)/g`) — ids are NOT restricted to
  hex (seeded ids like `e2` and imported ids both work; regression-tested).
- Chosen over `@Name` plain text (not machine-parseable) and over hidden
  metadata attributes (breaks the plain-text content contract).

## Picker (DECISION)

Lightweight custom listbox instead of cmdk: the input IS the controlled
textarea, and a cmdk Command root brings its own input/focus model that would
fight the editor. Keyboard interaction lives on the textarea using the ARIA
combobox pattern (`role="combobox"` + `aria-expanded`/`aria-controls`/
`aria-activedescendant`, options are `role="option"` with `aria-selected`).
44 px hit targets, max 6 results (matches the command palette), case-insensitive
name-substring filter, `@` with an empty query shows the initial list.
Popup position is measured with a hidden font-mirror div; it flips above the
caret when it would overflow the textarea bottom. Closing rules:
- Escape / blur dismisses the CURRENT trigger (`@` index) — the same trigger
  stays closed while the user keeps typing; a new `@` reopens it.
- Whitespace or `]` in the query ends the trigger (prose after a stray `@`,
  hand-typed markdown links).
- Caret inside an existing token is never a trigger.

## Save-time link derivation (DECISION)

Links are **derived from the final content at save**, never accumulated:
`extractMentionLinks(content, entities, excludeId)` parses tokens, resolves
them against live entities (missing/deleted ids skipped), skips the id being
saved (self-mention), dedupes, and returns `{ targetId, relation: 'mentions' }`
entries merged into the entity's existing `links` (`mergeMentionLinks` keeps
existing pairs and order). Removing the mention text before saving therefore
automatically removes the link — no desync.

## Backlinks (DECISION)

Reciprocal backlinks are **default-on** (no picker option — keeps the picker
minimal and the semantics predictable): on save, every mentioned target gains
`{ targetId: sourceId, relation: 'mentioned-in' }` and targets that are no
longer mentioned LOSE their stale backlink (`applyMentionBacklinks` returns
only entities whose links changed). Writes go through the existing
`saveEntity` action — no store changes. NOTE: `saveEntity` also navigates to
the library and clears editing state, so saving an entity WITH mentions lands
on the library (matches the "Save to library" button); entities without
mentions keep the previous stay-in-editor behavior. Relation strings are
consumed generically by graph-view (edges render any relation); a known
display limitation: graph-view dedupes edges by `source-target`, so a second
relation between the same pair is not drawn (pre-existing, out of scope).

## Files

- `src/lib/editor/mention.ts` — pure helpers + token regex (no React).
- `src/components/studio/views/editor-mention-picker.tsx` — presentational
  popover (memo), caret measurement, combobox listbox.
- `src/lib/i18n/messages/mentions.ts` — picker strings via `makeT` (keys
  notified to Main for the registry).
- `editor-view.tsx` — trigger/candidates/highlight/dismiss state, keyboard
  handling, save-path integration, preview `a` component.
- Tests: `mention.test.ts` (trigger/token/links/backlinks), picker component
  test, editor-view integration suite (open/filter/insert/keyboard/Escape/
  save-links/backlink/revoke).
- `e2e/editor-mentions.spec.ts` — type `@`, pick seed entity, preview chip,
  save, graph edges `mentions` + `mentioned-in`.

## Follow-ups / risks

- Graph-view edge id dedupe (`${source}-${target}`) hides a second relation
  between the same pair; mention links to an already-linked target exist in
  the data but may not render as a separate edge.
- `editor-hooks.tsx` `useEditorDraft` still types `type: EntityType`; with the
  N7 `AnyEntityType` editor state this needs a 3-line widening (flagged to
  Main — N3 can apply on confirmation).
- Description fallback still derives from raw content (pre-existing) and will
  include token markdown if the user never sets a description.