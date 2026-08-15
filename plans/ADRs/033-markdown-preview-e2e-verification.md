# ADR 033: Markdown Preview E2E Verification

## Status

Approved — implemented with Plan 125
(`plans/125-markdown-preview-e2e-2026-08-15.md`); GFM extensions enabled
via `remark-gfm` (PR #690).

## Context

The editor (`editor-view.tsx`) renders `Entity.content` through
`react-markdown` v10 in preview and split modes:

```tsx
<Markdown>{content || '_Nothing to preview._'}</Markdown>
```

The same markdown pipeline renders assistant chat replies
(`chat-view.tsx`). `react-markdown` v10 ships a default `urlTransform`
that blocks dangerous schemes (`javascript:`, `data:`, `vbscript:`), so
links are already scheme-safe.

What is missing is **verification that the preview actually renders
correct markdown**. Existing E2E coverage (`e2e/editor.spec.ts`)
exercises entity creation, mode switching, and validation, but never
asserts the rendered HTML for headings, emphasis, lists, links, tables,
task lists, or the empty-state placeholder. A regression in the preview
pipeline (e.g., a dependency bump that changes heading mapping or breaks
GFM tables) would ship undetected.

ADR 020 established the content contract: CommonMark is the baseline,
GFM extensions are used when editor, preview, import/export, and tests
agree on the same dialect. The entity name is the document-level
heading; preview heading mapping must be verified.

## Decision

Verify markdown preview correctness with a dedicated E2E spec
(`e2e/markdown-preview.spec.ts`) that:

1. **Drives the real UI**: creates an entity, types a representative
   markdown sample into the editor textarea, switches to preview mode,
   and asserts the rendered DOM.
2. **Covers the canonical syntax subset actually supported.** The app
   renders with `react-markdown` v10 plus **`remark-gfm`** (enabled per
   ADR 020's opt-in rule: editor, preview, and tests agree on the
   dialect; GFM is a superset of the CommonMark used by export):
   - Headings `#`/`##`/`###` rendered as semantic `h1`/`h2`/`h3`
   - Emphasis: `**bold**`, `*italic*`, `` `inline code` ``
   - Lists: unordered and ordered
   - Blockquote and thematic break (`hr`)
   - Links: rendered as anchors (scheme safety already enforced by
     react-markdown's default `urlTransform`)
   - GFM: tables (header + body cells), task lists (disabled checkboxes
     with correct checked state), and strikethrough (`del`) — covered
     by a dedicated render test.
3. **Asserts semantically** via Playwright role/locator queries scoped to
   the preview pane (`.prose`), not raw HTML string matching — the tests
   verify the format a user/AT actually perceives.
4. **Covers the empty-state placeholder** (`_Nothing to preview._`) and
   split mode (textarea + preview rendered side by side).

Unit-level markdown rendering is intentionally NOT duplicated: the
pipeline is a thin wrapper over react-markdown, whose behavior is
upstream-tested; E2E covers the integration contract.

## Consequences

- A new E2E spec adds ~9 tests across the CI E2E job (runs on
  frontend/`src/**` changes per the existing workflow filter).
- The spec doubles as living documentation of the supported markdown
  subset, so editor/export changes must keep the sample passing or
  update it deliberately.
- The sample input is a shared fixture, so adding a syntax element
  later is one edit + one assertion block.
- GFM is enabled in both markdown render sites (editor preview and
  chat assistant messages) via `remark-gfm`; import/export remains
  CommonMark-compatible (GFM is a superset).
