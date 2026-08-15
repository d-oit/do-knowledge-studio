# Plan 125 — Markdown Preview E2E Verification (GOAP) (2026-08-15)

Date: 2026-08-15
Status: IMPLEMENTED — spec merged via PR #689; GFM enabled via PR #690
ADR: `plans/ADRs/033-markdown-preview-e2e-verification.md`

## Task Analysis (GOAP Phase 1)

**Primary Goal**: Add E2E tests proving the editor's markdown preview
renders correct format output — h1, bold, and the full supported
syntax subset — in a real browser.

**Constraints**:

- Plan artifacts (this file + ADR 033) land first, before implementation.
- E2E only; no unit-level duplication of react-markdown behavior
  (upstream-tested).
- Must pass the full quality workflow: lint, typecheck, unit, E2E
  (all viewport projects), and CI must be green before merge.

**Complexity**: Medium — new spec file, no app code changes expected.

## Sub-Goals (GOAP Phase 2)

- **G1** — Analyze preview pipeline (editor-view + react-markdown v10), P0
- **G2** — Write ADR 033 (verification decision), P0, deps: G1
- **G3** — Write this GOAP plan, P0, deps: G1
- **G4** — Implement `e2e/markdown-preview.spec.ts`, P1, deps: G2, G3
- **G5** — Validate: lint, typecheck, unit, E2E all viewports, P1, deps: G4
- **G6** — PR, CI, merge, cleanup, P1, deps: G5

## Reality Check (from analysis)

- Preview renders `<Markdown>{content || '_Nothing to preview._'}</Markdown>`
  in a `.prose` container for `editMode === 'preview' | 'split'`.
- Editor mode is a radio group labeled "editor mode" with 3 radios
  (edit / preview / split). Existing spec `editor.spec.ts` already
  switches modes — reuse its navigation pattern.
- The editor textarea has `aria-label="Editor content"`; content is
  local state, so typing markdown then switching to preview requires no
  save.
- `react-markdown` v10 default `urlTransform` blocks dangerous link
  schemes — link tests assert the anchor + href only.
- **GFM (follow-up, PR #690)**: `remark-gfm` is now enabled in the
  editor preview and chat markdown render sites; tables, task lists,
  and strikethrough render as real elements and the E2E covers them.

## Execution Strategy (GOAP Phase 3-4)

- Strategy: **Sequential** (analysis → artifacts → spec → validate).
- Quality gates: markdownlint on plan/ADR; lint+typecheck+unit before
  E2E; full E2E suite on all 4 viewport projects; full CI green.

### G4 — Spec design (`e2e/markdown-preview.spec.ts`)

**Reality check (updated for PR #690)**: `remark-gfm` is enabled, so
tables, task lists, and strikethrough render as real elements; the
GFM test asserts rendered output instead of literal text.

Shared fixture: a `MARKDOWN_SAMPLE` constant exercising every
supported element. beforeEach: goto `/`, navClick editor, create
entity, fill name, fill textarea, switch to preview radio.

Tests:

1. Headings render at correct levels (h1/h2/h3 via role + level).
2. Emphasis renders: `strong`, `em`, `code`.
3. Unordered and ordered lists render (`ul`/`ol` with items).
4. Blockquote and horizontal rule render.
5. Links render as anchors with the expected href.
6. GFM renders: table (columnheader/cell), task list (2 checkboxes,
   unchecked + checked), strikethrough (`del`).
7. Split mode renders textarea + preview together.
8. Empty content shows the `_Nothing to preview._` placeholder.

All assertions scoped to the preview container (`div.prose`) to avoid
collisions with app chrome.

## Validation Plan (GOAP Phase 5)

- `npx markdownlint -c markdownlint.toml` on both new plan files.
- `pnpm run lint` + `pnpm run typecheck` + `pnpm run test`.
- `pnpm exec playwright test e2e/markdown-preview.spec.ts --project=chromium`
  then the full E2E suite (all viewports) to catch regressions.
- Commit via minimal quality gate; PR; monitor CI (E2E job must run —
  `e2e/**` is in the frontend filter since #682); merge.

## Summary (after completion)

✓ Analysis, ADR 033, GOAP plan, spec, validation, PR merge.
