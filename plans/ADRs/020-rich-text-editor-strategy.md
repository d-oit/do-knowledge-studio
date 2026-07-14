# ADR 020 — Markdown Content and Editor Engine

**Date**: 2026-07-12
**Status**: Accepted for implementation
**Supersedes**: ADR 020 revision dated 2026-07-09
**Related**: `plans/053-goap-markdown-editor-ux-2026-07-12.md`, ADR 023, ADR 024

## Context

The previous revision is stale. The current `editor-view.tsx` is 304 lines,
already renders an Edit/Preview mode with `react-markdown`, and the manifest no
longer contains MDXEditor or syntax-highlighter dependencies. The remaining
problem is that editing is still a plain controlled `<textarea>` while every
formatting action in `editor-toolbar.tsx` only displays a toast saying that it
“would apply formatting.”

The repository rule that Markdown is not canonical truth must remain intact.
The canonical record is the structured `Entity` persisted by Zustand. Markdown
is only the encoding of the `Entity.content` field; files exported as Markdown
do not become an independent source of truth.

The editor needs dependable formatting, native undo/redo, keyboard shortcuts,
IME support, accessible preview, and responsive modes without introducing a
WYSIWYG abstraction that can silently rewrite Markdown.

## Decision

Adopt a **Markdown-source-first editor with progressive enhancement**.

### Content contract

1. `Entity` remains canonical; `Entity.content` is a Markdown string.
2. CommonMark is the baseline syntax. A GFM extension set—tables, task lists,
   strikethrough, and autolinks—may be enabled only when editor, preview,
   import/export, and tests all agree on the same dialect.
3. Raw HTML is disabled in rendered preview. Any future opt-in HTML support
   requires sanitization and a security review.
4. Preview links validate their scheme. External links use safe target and
   relationship attributes.
5. The entity name is the document-level heading. Preview heading mapping must
   preserve a valid page hierarchy rather than introducing another competing
   `h1`.

### Editing engine

1. Keep the native textarea for the first implementation, backed by pure,
   selection-aware Markdown transformation functions.
2. Formatting is a text transaction, not a notification. Commands modify the
   selected range, restore focus, preserve the intended selection/caret, and
   produce one native undo unit where the platform permits.
3. Implement a time-boxed spike before the full toolbar. The spike must prove:
   - bold and a multiline command work with collapsed, forward, and backward
     selections;
   - undo and redo restore text and selection in one step;
   - Unicode grapheme boundaries and IME composition are not corrupted;
   - keyboard and pointer activation preserve focus;
   - supported desktop and mobile browsers behave consistently.
4. Do not build a custom undo manager. If the spike fails any must-pass item,
   adopt CodeMirror 6 before adding the remaining formatting commands.
5. CodeMirror also becomes the preferred engine if committed requirements add
   syntax-aware editing, multi-selection, search/replace, large-document
   virtualization, or transactional extensions. It is not added speculatively.
6. WYSIWYG and MDXEditor are out of scope. The user must always be able to see
   and control the Markdown source.

### Formatting semantics

- Bold and italic wrap or safely unwrap a selection.
- Heading, quote, bullet-list, and ordered-list commands operate on every
  selected line and preserve indentation where possible.
- Code chooses inline backticks for a single line and fenced code for multiline
  selections.
- Link insertion uses selected text as the label, focuses/selects the URL
  portion, and validates unsafe schemes inline.
- Commands are deterministic and idempotent where unambiguous. A second command
  must not progressively corrupt prefixes or delimiters.
- Keyboard shortcuts run only while the editor owns focus and must not conflict
  with text composition.

### Presentation modes

1. Support Edit and Preview everywhere.
2. Add Split only when the editor container has enough usable width. Do not use
   viewport width alone because the sidebar and right panel reduce the actual
   canvas.
3. Split expands the editor canvas and collapses deterministically to Edit when
   space becomes insufficient. Mobile exposes Edit/Preview, not a squeezed
   split view.
4. Preview rendering is deferred or debounced so Markdown rendering cannot
   block typing in realistic long documents.

## Consequences

- Formatting becomes real, predictable editing instead of toast-driven control
  theater.
- Markdown remains portable and diffable without making exported files
  canonical.
- The native textarea keeps bundle cost and accessibility risk low while the
  decision gate prevents accumulating fragile custom editor behavior.
- CodeMirror remains a defined fallback with measurable triggers, not an
  indefinite “maybe later.”
- Preview and export behavior must share syntax fixtures to prevent dialect
  drift.

## Alternatives considered

1. **Adopt CodeMirror immediately.** Rejected for the current modest command
   set, subject to the mandatory spike. Its bundle and integration cost are
   justified only if native transactions fail or advanced requirements become
   committed.
2. **Adopt MDXEditor/WYSIWYG.** Rejected because it obscures source Markdown,
   increases round-trip risk, and solves a different editing model.
3. **Use `contentEditable` directly.** Rejected because selection, IME,
   clipboard, semantics, and browser consistency would become application code.
4. **Keep toast-only formatting controls.** Rejected because controls must
   perform the action they advertise.
