# ADR 002: XSS Prevention in Export Paths

## Status
Implemented — XSS prevention via shared HTML sanitization; WebCrypto AES-GCM encryption added in Plan 050.

## Context
Both browser (`ExportPanel.tsx`) and CLI (`cli/index.ts`) site export paths construct HTML by string concatenation without escaping user-provided content (entity names, descriptions, claim statements). Since entity descriptions originate from the TipTap editor and may contain arbitrary HTML, an attacker could inject JavaScript that executes when the exported page is opened.

## Decision
We will implement a shared HTML sanitization layer that all export paths must use:

1. **For rich HTML content** (TipTap editor output): Use DOMPurify to strip dangerous tags/attributes while preserving safe formatting (bold, italic, lists, links).
2. **For plain text content** (entity names, claim statements): Use `escapeHtml()` to encode `&<>"'` entities.
3. **Shared utility**: Place sanitization in `src/lib/security.ts` (existing file, augment it).
4. **Both paths use it**: `ExportPanel.tsx` and `cli/index.ts` call the same functions.

## Alternatives Considered
- **Manual escaping per file**: Prone to missing a path. Rejected in favor of shared utility.
- **DOMPurify only**: Overkill for plain text fields. Using both approaches for appropriate content types.
- **Server-side sanitization**: Not applicable (local-first, no server).
- **Content Security Policy in exported HTML**: Secondary defense, but doesn't prevent inline script injection in the HTML file itself.

## Implementation Plan
1. Add DOMPurify to dependencies (`pnpm add dompurify && pnpm add -D @types/dompurify`)
2. Export `sanitizeHtml(html: string): string` and `escapeHtml(text: string): string` from `src/lib/security.ts`
3. Update `ExportPanel.tsx` static site export to call sanitization on all user fields
4. Update `cli/index.ts` `exportSite()` to call the same functions (or a shared `generateEntityHtml()`)
5. Extract shared HTML generation into `src/lib/export-core.ts` (see ADR-006)
6. Add security test file `src/lib/__tests__/security.test.ts` with XSS vector tests

## Consequences
- **Positive**: Eliminates critical XSS vectors in all export paths
- **Positive**: Shared utility prevents future export paths from introducing XSS
- **Negative**: Added dependency on DOMPurify (~15KB gzipped)
- **Negative**: Need to maintain DOMPurify allowlist as TipTap extensions evolve
- **Risk**: DOMPurify configuration must be reviewed when new rich content types are added

## Acceptance Criteria
- [x] DOMPurify added as dependency, verified bundle size impact
- [x] `sanitizeHtml()` and `escapeHtml()` exported from `src/lib/security.ts`
- [x] `ExportPanel.tsx` uses sanitization for all user fields in static site export (via `export-helpers.ts`)
- ~~`cli/index.ts` uses the same shared functions~~ — No CLI exists in the codebase (removed during Next.js migration)
- [x] XSS test vectors (script tags, event handlers, javascript: URLs) are all neutralized
- [x] Safe HTML (bold, italic, lists) is preserved in exported content
- [x] `npm run typecheck` passes with no errors
- [x] Existing tests pass
