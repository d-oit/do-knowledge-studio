# ADR 012: PDF Export via @react-pdf/renderer

## Status
PROPOSED (2026-06-16) — Implementation tracked in `plans/040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md`

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
We will add **PDF export using `@react-pdf/renderer`** (v4.x):

### Why `@react-pdf/renderer` and not alternatives

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `@react-pdf/renderer` | React component API, fits existing stack, declarative | ~1.5MB minified, runs in browser | ✅ **Chosen** |
| `pdfmake` | Declarative JSON DSL, no React | Different paradigm from rest of app, two APIs to learn | ❌ |
| `jsPDF` | Mature, small (~400KB) | Imperative API, painful for complex layouts | ❌ |
| `pdf-lib` | Pure JS, modify existing PDFs | Even more imperative, no layout engine | ❌ |
| Headless Chrome (Puppeteer) | Pixel-perfect HTML→PDF | Requires Chrome install; local-first rule broken | ❌ |
| Server-side rendering (e.g., wkhtmltopdf) | Renders arbitrary HTML | Backend required — violates local-first | ❌ |

`@react-pdf/renderer` is the only option that:
1. Runs in-browser (local-first compliant)
2. Matches the React/TS stack
3. Has a layout engine (handles pagination, fonts, margins)
4. Maintained by React ecosystem authors

### API shape

```ts
// src/features/export/pdf-exporter.tsx
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.6 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  body: { fontSize: 11, lineHeight: 1.6 },
  tag: { fontSize: 9, color: '#666', marginTop: 8 },
  h1: { fontSize: 20, marginTop: 16, marginBottom: 8, fontWeight: 'bold' },
  h2: { fontSize: 16, marginTop: 12, marginBottom: 6, fontWeight: 'bold' },
});

export async function exportNoteToPDF(note: Note): Promise<Blob> {
  return pdf(<NoteDocument note={note} />).toBlob();
}

export async function exportAllNotesToPDF(notes: Note[]): Promise<Blob> {
  return pdf(<NotesDocument notes={notes} />).toBlob();
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
- **NEW** `src/features/export/pdf-exporter.tsx` — React-PDF components + exports
- **NEW** `src/features/export/__tests__/pdf-exporter.test.tsx` — Unit tests
- `src/features/export/ExportPanel.tsx` — Add "Export PDF" button (dynamic import)
- `cli/commands/export.ts` — Add `pdf` format
- `package.json` — Add `@react-pdf/renderer` dep
- `pnpm-lock.yaml` — Auto-updated

## Verification
- Click "Export PDF" in browser → downloads valid PDF
- Open PDF in Preview/Acrobat → text is selectable, layout is correct
- Multi-note PDF includes table of contents
- `pnpm run cli -- export pdf -o /tmp/out.pdf` produces valid file
- `file /tmp/out.pdf` reports `PDF document`
- Unit test: `exportNoteToPDF()` resolves with non-empty Blob
