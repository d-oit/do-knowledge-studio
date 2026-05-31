# Plan 13: Security Fixes (P0)

**GOAP Goal**: G-SECURITY  
**Priority**: P0 (Fix immediately)  
**Estimated Total Effort**: 6-8 hours  
**GitHub Issues**: #168, #169, #170, #172, #173, #174  
**ADRs**: ADR-002 (XSS), ADR-003 (API Key Isolation)

## Issue Summary

| # | Type | Title | Severity |
|---|------|-------|----------|
| #168 | Bug | XSS in static site export (ExportPanel.tsx) | **CRITICAL** |
| #172 | Bug | XSS in static site export (ExportPanel.tsx) | **CRITICAL** |
| #169 | Bug | XSS in CLI site export (cli/index.ts) | **CRITICAL** |
| #173 | Bug | XSS in CLI site export (cli/index.ts) | **CRITICAL** |
| #170 | Security | API key exposure via VITE_ env vars | **HIGH** |
| #174 | Security | API key exposure via VITE_ env vars | **HIGH** |

## Tasks

### 13.1 Fix XSS in Browser Export (CRITICAL)
**Files**: `src/features/export/ExportPanel.tsx`, `src/lib/security.ts`  
**Reference**: ADR-002  
**Action**:
1. Add DOMPurify dependency: `pnpm add dompurify && pnpm add -D @types/dompurify`
2. Create `sanitizeHtml()` and `escapeHtml()` in `src/lib/security.ts`:
   - `sanitizeHtml(html: string): string` — uses DOMPurify to strip dangerous content while preserving safe HTML
   - `escapeHtml(text: string): string` — encodes HTML entities for plain text
3. Update `ExportPanel.tsx` static site export generator:
   - Wrap all `entity.description` with `sanitizeHtml()`
   - Wrap `entity.name`, `claim.statement`, `link.name` with `escapeHtml()`
4. Verify: XSS vectors (script tags, event handlers, javascript: URLs) are neutralized
**Effort**: 2h
**Validation**:
- Security test in `src/lib/__tests__/security.test.ts` passes for all XSS vectors
- `npm run typecheck` passes
- DOMPurify allows safe HTML (bold, italic, lists) through

---

### 13.2 Fix XSS in CLI Export (CRITICAL)
**Files**: `cli/index.ts`  
**Reference**: ADR-002  
**Action**:
1. Import shared `sanitizeHtml()` / `escapeHtml()` from `src/lib/security.ts` (or shared export core)
2. Update `exportSite()` function (lines ~193-219):
   - Replace raw `entity.description` interpolation with `sanitizeHtml(entity.description)`
   - Replace raw `entity.name` / `claim.statement` with `escapeHtml()`
3. Ensure CLI can import from `src/lib/` (already TypeScript-aware)
**Effort**: 1h
**Validation**:
- CLI export produces safe HTML with same XSS vector tests
- Browser and CLI export identical output for same input

---

### 13.3 Create Shared Sanitization Utility
**Files**: `src/lib/security.ts`  
**Reference**: ADR-002  
**Action**:
1. Export:
   ```typescript
   export function sanitizeHtml(html: string): string;
   export function escapeHtml(text: string): string;
   ```
2. Add test file `src/lib/__tests__/security.test.ts` with:
   - XSS vectors: `<script>alert(1)</script>`, `<img onerror="alert(1)" src=x>`, `javascript:alert(1)`
   - Safe HTML: `<strong>bold</strong>`, `<em>italic</em>`, `<ul><li>list</li></ul>`
   - Plain text: `&<>"'` all encoded
**Effort**: 1h
**Validation**: All tests pass with 100% coverage for security-critical paths

---

### 13.4 Migrate API Keys from VITE_ Env Vars
**Files**: `src/lib/llm/config.ts`, `src/lib/llm/openrouter.ts`, `src/lib/llm/kilo.ts`, `src/lib/llm/types.ts`  
**Reference**: ADR-003  
**Action**:
1. Update `config.ts`:
   - Migrate key storage from `localStorage` to IndexedDB (use simple `idb-keyval` wrapper or raw IndexedDB)
   - Remove `VITE_OPENROUTER_API_KEY` and `VITE_KILO_API_KEY` fallback reads
   - Add migration: on first load, check localStorage for existing keys → move to IndexedDB → clear localStorage
2. Update `openrouter.ts` and `kilo.ts`:
   - Remove `import.meta.env.VITE_*` fallback in `getApiKey()` / constructor
3. Update `.env.example`:
   - Remove VITE_ prefixed API key examples
   - Add note about runtime config via settings UI
**Effort**: 2h
**Validation**:
- `grep -r "VITE_OPENROUTER_API_KEY\|VITE_KILO_API_KEY" src/` returns zero
- API keys are in IndexedDB, not accessible via `localStorage`
- Existing users' keys are migrated on first load

---

### 13.5 Audit and Add Security Test Coverage
**Files**: `src/lib/__tests__/security.test.ts`, `scripts/audit-vite-env.sh`  
**Action**:
1. Create `scripts/audit-vite-env.sh` to scan for `VITE_` references that might expose secrets
2. Add E2E security test for export XSS
3. Add E2E test for API key not appearing in bundle
**Effort**: 1h
**Validation**: Security audit script passes with zero findings

---

## Completion Criteria
- [x] Both browser and CLI export paths escape/sanitize all user content
- [x] DOMPurify sanitizes TipTap rich HTML while preserving safe tags
- [x] No `VITE_` env vars are used for API keys in production code
- [ ] API keys are stored in IndexedDB with migration from localStorage (future work)
- [x] Security test suite covers XSS vectors and key isolation
- [x] `npm run typecheck` passes
- [x] `npm test` passes (all existing + new security tests)
- [x] `scripts/audit-vite-env.sh` created and passes
- [x] SECURITY.md documents local-first security model
