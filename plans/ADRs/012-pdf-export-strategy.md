# ADR 012: PDF Export via jsPDF

## Status
IMPLEMENTED (2026-07-26) — Implemented via jsPDF in `src/components/studio/views/export-helpers.ts`

**Note**: Original ADR proposed @react-pdf/renderer. Implementation chose jsPDF for smaller bundle size (~400KB vs ~1.5MB) and simpler imperative API. The tradeoff is accepted: complex layouts are harder but sufficient for current requirements.

## Context
Issue #289 identifies PDF export as a critical missing feature. The studio currently exports:
- Markdown (text)
- JSON (structured)
- Static HTML site (multi-page)
- DOCX (Word)

PDF is the de facto format for sharing, printing, and archiving. It is required by users who want to:
- Print notes for offline study
- Share with collaborators who don't have the studio installed
- Archive snapshots in a non-editable format
- Submit to publishers or institutions

The current DOCX export uses dynamic `import('docx')` in `ExportPanel.tsx` (lazy-loaded) — a pattern we should mirror for PDF to avoid bundle bloat.

## Decision
We will add **PDF export using `jsPDF`**:

### Why jsPDF

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `@react-pdf/renderer` | React component API, fits existing stack, declarative | ~1.5MB minified, runs in browser | ❌ Too heavy |
| `pdfmake` | Declarative JSON DSL, no React | Different paradigm from rest of app, two APIs to learn | ❌ |
| `jsPDF` | Mature, small (~400KB), simple API | Imperative API, manual layout | ✅ **Chosen** |
| `pdf-lib` | Pure JS, modify existing PDFs | Even more imperative, no layout engine | ❌ |
| Headless Chrome (Puppeteer) | Pixel-perfect HTML→PDF | Requires Chrome install; local-first rule broken | ❌ |
| Server-side rendering (e.g., wkhtmltopdf) | Renders arbitrary HTML | Backend required — violates local-first | ❌ |

jsPDF was chosen for:
1. Smallest bundle impact (~400KB vs ~1.5MB for @react-pdf/renderer)
2. Simple imperative API sufficient for current requirements
3. Mature and well-maintained
4. No React dependency for PDF generation

### API shape

```ts
// src/components/studio/views/export-helpers.ts
import { jsPDF } from 'jspdf'

export async function buildPdfExport(
  entities: Entity[],
  claims: Claim[],
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  // ... layout logic
  return doc.output('blob')
}
```

### Bundle impact
- **Dynamic import** in `ExportPanel.tsx`, matching the `docx` pattern
- Only loaded when user clicks "Export PDF"
- Initial bundle unaffected (Vite code-splits automatically)

### CLI integration
- `pnpm run cli -- export pdf -o ./out` uses the same `pdf()` function
- Works in Node — `@react-pdf/renderer` has a Node API

### Limitations accepted
- No support for full Markdown → PDF rendering in v1 (plain text + headings only)
- Custom fonts must be registered explicitly (deferred — uses Helvetica)
- Complex layouts (tables, images) deferred to v1.1

## Alternatives Considered
- **Reuse static HTML export + Puppeteer**: Violates local-first; requires Chrome
- **Generate PDF from Markdown via `md-to-pdf`**: Wraps Puppeteer, same problem
- **Skip PDF, document the gap**: Issue #289 explicitly lists it as a requirement

## Consequences

### Positive
- Completes the export format matrix (MD, JSON, HTML, DOCX, **PDF**)
- Same component model as the rest of the app — easier to maintain
- Browser + CLI support from one implementation
- Reuses existing `Note`, `Entity` types

### Negative
- ~1.5MB added to download when user clicks PDF button (acceptable — one-time)
- New dep to maintain (`@react-pdf/renderer`)
- Some Markdown features not yet supported (will be addressed iteratively)

## Implementation Plan
See `plans/040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md`, actions B1, B3.

### Phased rollout
1. **v1.0 (this PR)**: Plain text + headings + tags, single-note + multi-note
2. **v1.1 (follow-up)**: Custom fonts, Markdown-to-PDF via remark
3. **v1.2 (follow-up)**: Graph visualization page, cover page with metadata

## Files Affected
- `src/components/studio/views/export-helpers.ts` — `buildPdfExport()` function using jsPDF
- `src/components/studio/views/use-export-handlers.ts` — PDF export handler
- `src/components/studio/views/export-format-grid.tsx` — PDF format card
- `src/components/studio/views/export-helpers.test.ts` — Unit tests for PDF export
- `src/components/studio/views/use-export-handlers.test.ts` — Integration tests
- `package.json` — `jspdf` dependency

## Verification
- ✅ Click "Export PDF" in browser → downloads valid PDF
- ✅ Open PDF in Preview/Acrobat → text is selectable, layout is correct
- ✅ Unit test: `buildPdfExport()` resolves with non-empty Blob with correct MIME type
- ✅ Integration test: `handleExport('pdf')` calls `buildPdfExport` + `downloadBlob`
