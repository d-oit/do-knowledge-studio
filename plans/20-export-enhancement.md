# Plan 20: Export Enhancement (P3)

**GOAP Goal**: G-EXPORT  
**Priority**: P3  
**Estimated Total Effort**: 8-12 hours  
**GitHub Issues**: #189, #191, #199

## Issue Summary

| # | Type | Title | Priority |
|---|------|-------|----------|
| #199 | Feature | Add graph export as PNG/image | LOW |
| #189 | Feature | Add PDF and DOCX export formats | LOW |
| #191 | Improvement | Deduplicate export logic between ExportPanel.tsx and CLI | MEDIUM |

## Dependency
**Prerequisite**: Plan 16 (G-QUALITY) + Plan 18 (G-FEATURES) — shared export core and feature foundation.

## Tasks

### 20.1 Deduplicate Export Logic (Foundation)
**Files**: `src/lib/export-core.ts`, `src/features/export/ExportPanel.tsx`, `cli/index.ts`  
**Issue**: #191 — Export logic duplicated  
**ADR**: ADR-006 (Export Core Deduplication)  
**Action**:
1. Create `src/lib/export-core.ts` with shared generators:
   - `generateSiteHtml(entities, claims, notes, links): string`
   - `generateEntityHtml(entity, claims): string`
   - `generateMarkdownExport(entities, claims): string`
   - `generateJsonExport(entities, claims, notes, links): string`
2. Refactor `ExportPanel.tsx` to use shared core
3. Refactor `cli/index.ts` to use shared core
4. Add unit tests for all generators
**Effort**: 3h
**Validation**: Browser and CLI produce identical output

---

### 20.2 Graph Export as PNG
**Files**: `src/features/graph/GraphControls.tsx`, `src/lib/graph-export.ts`  
**Issue**: #199 — No way to export graph visualization as image  
**Action**:
1. Implement PNG export using Sigma.js `renderer.toCanvas()`:
   ```typescript
   async function exportGraphAsPNG(
     renderer: SigmaRenderer,
     options?: { width?: number; height?: number; background?: string }
   ): Promise<Blob>;
   ```
2. Default to 1920x1080 with transparent background
3. Add "Export as PNG" button in `GraphControls.tsx`
4. Trigger browser download: `canvas.toBlob()` → `URL.createObjectURL()`
5. Add progress indicator for large renders
**Effort**: 2h
**Validation**:
- PNG exports at specified resolution
- Transparent background preserved
- Graph labels are readable in exported image
- Download button triggers file save

---

### 20.3 PDF Export
**Files**: `src/lib/export-core.ts`, `src/features/export/ExportPanel.tsx`  
**Issue**: #189 — No PDF export format  
**Action**:
1. Implement PDF export using browser's built-in print-to-PDF API:
   ```typescript
   async function exportAsPDF(html: string): Promise<void> {
     // Create hidden iframe with formatted HTML
     // Call window.print() on the iframe
     // User saves as PDF via browser print dialog
   }
   ```
2. Alternative: Use `jsPDF` library for programmatic PDF generation:
   ```bash
   pnpm add jspdf @types/jspdf
   ```
3. Format: Each entity as a section with claims listed below
4. Add "Export as PDF" option to `ExportPanel.tsx`
5. Include metadata (title, date, entity count) in PDF header
**Effort**: 2.5h
**Validation**:
- PDF produces valid document with correct structure
- Entity names, descriptions, and claims are readable
- PDF can be opened in Acrobat, Chrome, macOS Preview
- File size is reasonable for 100 entities (target <5MB)

---

### 20.4 DOCX Export
**Files**: `src/lib/export-core.ts`, `src/features/export/ExportPanel.tsx`  
**Issue**: #189 — No DOCX export format  
**Action**:
1. Add `docx` npm package:
   ```bash
   pnpm add docx
   ```
2. Implement DOCX generation:
   ```typescript
   import { Document, Packer, Paragraph, Table, TableRow, TableCell } from 'docx';
   
   async function exportAsDOCX(entities: Entity[], claims: Claim[]): Promise<Blob>;
   ```
3. Format:
   - Title page: "Knowledge Studio Export"
   - Each entity: Heading 1 with name and type
   - Claims under each entity: Bullet list with statement and confidence
   - Links section: Table with source → target mapping
4. Add "Export as DOCX" option to `ExportPanel.tsx`
5. Add progress indicator for large exports
**Effort**: 3h
**Validation**:
- DOCX opens correctly in Word, LibreOffice, Google Docs
- Formatting is clean (headings, lists, tables)
- Images (entity icons) are embedded or linked
- File size is reasonable for 100 entities (target <2MB)

---

### 20.5 Export UI Enhancements
**Files**: `src/features/export/ExportPanel.tsx`  
**Action**:
1. Redesign export panel with format cards:
   ```tsx
   <ExportCard
     format="markdown"
     icon={MarkdownIcon}
     description="Portable text format, good for version control"
     onExport={handleMarkdownExport}
   />
   ```
2. Show export progress per format
3. Show error state with retry button per format
4. Show success state with file size summary
5. Add "Export All" button for batch export of all formats
6. Add export history log (optional, local-only)
**Effort**: 1.5h
**Validation**:
- Export panel is intuitive and responsive
- Progress/error/success states work for all formats
- Batch export produces all formats in one click

---

## Completion Criteria
- [ ] Shared export core eliminates duplication between browser and CLI
- [ ] Graph exports as 1080p PNG from GraphControls
- [ ] PDF export produces valid documents via jspdf
- [ ] DOCX export produces valid Word documents via docx library
- [ ] Export panel shows progress/error/success states
- [ ] All quality gates pass: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`
