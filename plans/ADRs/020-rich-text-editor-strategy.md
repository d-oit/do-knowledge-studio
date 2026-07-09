# ADR 020 — Editor Rich-Text / Markdown Strategy

**Date**: 2026-07-09
**Status**: Proposed
**Related**: GOAP action C2

## Context

`src/components/studio/views/editor-view.tsx` (581 LOC — over the 500 limit) uses
a plain `<textarea>` with the placeholder "Start writing. Use markdown for
headings, lists, and emphasis…". Nothing renders that markdown — there is no
preview and no rich-text editing. Meanwhile the project ships three unused
editor/markdown dependencies: `@mdxeditor/editor`, `react-markdown`, and
`react-syntax-highlighter`. Chat replies (`chat-view.tsx`) also render as plain
text even though seed content is markdown.

## Decision

Adopt a **markdown-first, progressively rich** editor:

1. **Storage stays markdown** (`Entity.content` is a markdown string) — no schema
   change, consistent with "Markdown is import/export" heritage.
2. **Rendering (v1).** Use `react-markdown` (already a dependency) to render a
   live preview in the editor and to render assistant messages in Chat. Add
   `react-syntax-highlighter` for fenced code blocks.
3. **Editing (v2).** Split `editor-view.tsx` first (ADR-independent, required by
   the 500-LOC rule), then evaluate `@mdxeditor/editor` for WYSIWYG. If it is
   not adopted, **remove it** from dependencies (per plan 048) rather than
   leaving it dead.
4. **Decision gate.** Keep a dependency only if it has a live call site. If v2
   WYSIWYG is deferred, the plain textarea + `react-markdown` preview is the
   shipped v1.

## Consequences

- Chat and Editor both render markdown consistently.
- The 500-LOC violation in `editor-view.tsx` is resolved as a precondition.
- Either `@mdxeditor/editor` gains a real call site or it is removed — no dead
  editor bundle.

## Alternatives Considered

1. **Full WYSIWYG now (`@mdxeditor/editor`).** Deferred: larger bundle and more
   surface area than needed for v1; revisit after the preview lands.
2. **Keep plain textarea, no rendering.** Rejected: markdown content already
   exists in seed data and is shown raw, which looks broken.
3. **Custom contentEditable editor.** Rejected: high maintenance for little gain
   over established libraries.
