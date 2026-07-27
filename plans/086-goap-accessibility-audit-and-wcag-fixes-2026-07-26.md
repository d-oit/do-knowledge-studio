# Plan 086 — GOAP: Accessibility Audit & WCAG 2.2 AA Fixes

**Date**: 2026-07-26
**Status**: DONE (PR #521 merged, all 23 CI checks pass)
**Method**: GOAP with hybrid execution (parallel swarm within waves)
**Orchestrator**: `goap-agent` skill with `parallel-execution`
**Branch**: `feat/086-accessibility-audit-wcag-fixes`
**PR**: [#521](https://github.com/d-oit/do-knowledge-studio/pull/521)

## Results

| Wave | Goal | Status | Changes |
|------|------|--------|---------|
| W1 | Fix mind map Tab keyboard trap | Done | `mindmap-view.tsx` — Tab exits tree, Ctrl+Tab adds child |
| W2 | Fix color contrast | Done | `globals.css` — saffron `#c77d3a` → `#9a5c2a` (5.0:1 ratio) |
| W2 | Fix form labels | Done | `ai-harness-settings.tsx` — Field htmlFor + React import; `shared-primitives.tsx` — SwitchToggle aria-label; `triz-view.tsx` — input aria-labels |
| W2 | Add aria-live regions | Done | `right-panel.tsx`, `ai-harness-chat.tsx`, `sync-view.tsx`, `triz-view.tsx` |
| W2 | Fix prefers-reduced-motion | Done | `sync-view.tsx`, `triz-view.tsx`, `offline-indicator.tsx` — useReducedMotion added |
| W2 | Fix focus indicators | Done | `mindmap-view.tsx` — focus-ring on expand button |
| W3 | Add contentinfo landmark | Done | `app-shell.tsx` — footer with role="contentinfo" |
| W3 | Add validation error feedback | Done | `editor-view.tsx` — toast on empty name save |
| W4 | Integrate axe-core | Done | `@axe-core/playwright` installed, `e2e/accessibility.spec.ts` — 9 view scans |
| W5 | Quality gate | Done | Lint, typecheck, test (1048), build all pass |

## Context

The accessibility audit from Plan 084 was code-analysis only — axe-core has never been run, no automated a11y testing exists, and 22 specific gaps were identified across P0/P1/P2 severity levels. This plan executes the full audit and fixes all P0/P1 findings, adds automated axe-core testing to CI, and addresses remaining P2 items.

## Goals

| ID | Goal | Priority | Effort |
|----|------|----------|--------|
| G1 | Fix mind map Tab keyboard trap (P0) | P0 | 1h |
| G2 | Fix color contrast — saffron accent in light mode (P1) | P1 | 1h |
| G3 | Fix missing form labels and aria associations (P1) | P1 | 1h |
| G4 | Add aria-live regions for dynamic content (P1) | P1 | 1h |
| G5 | Fix prefers-reduced-motion for framer-motion components (P1) | P1 | 1h |
| G6 | Add missing focus-visible styles (P2) | P2 | 30min |
| G7 | Add contentinfo landmark (P2) | P2 | 15min |
| G8 | Integrate @axe-core/playwright for automated a11y CI (P2) | P2 | 2h |
| G9 | Run axe-core, fix any remaining critical/serious violations | P1 | 1h |
| G10 | Create PR, verify CI, address feedback | P0 | 1h |

## Wave Structure

### Wave 1 — P0 Critical Fix (sequential, must complete first)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W1.1 | Fix mind map Tab key to not trap — Tab should move focus out of tree | G1 | `src/components/studio/views/mindmap-view.tsx` |

### Wave 2 — P1 Fixes (parallel swarm, 5 agents)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W2.1 | Darken saffron accent for WCAG AA compliance in light mode | G2 | `src/app/globals.css` |
| W2.2 | Fix Field component htmlFor, add aria-labels to unlabeled inputs | G3 | `src/components/studio/ai-harness-settings.tsx`, `src/components/studio/views/triz-view.tsx`, `src/components/studio/shared-primitives.tsx` |
| W2.3 | Add aria-live regions for search results, chat messages, validation errors | G4 | `src/components/studio/right-panel.tsx`, `src/components/studio/views/ai-harness-chat.tsx`, `src/components/studio/views/editor-view.tsx` |
| W2.4 | Add useReducedMotion to sync-view, triz-view, offline-indicator, shortcuts-dialog | G5 | `src/components/studio/views/sync-view.tsx`, `src/components/studio/views/triz-view.tsx`, `src/components/studio/offline-indicator.tsx`, `src/components/studio/shortcuts-dialog.tsx` |
| W2.5 | Add focus-ring to chat clear button and mindmap expand/collapse | G6 | `src/components/studio/views/chat-view.tsx`, `src/components/studio/views/mindmap-view.tsx` |

### Wave 3 — P2 Fixes + Landmark (parallel, 2 agents)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W3.1 | Add footer/contentinfo landmark to app shell | G7 | `src/components/studio/app-shell.tsx` |
| W3.2 | Add aria-live for sync status and TRIZ results | G4/G7 | `src/components/studio/views/sync-view.tsx`, `src/components/studio/views/triz-view.tsx` |

### Wave 4 — axe-core Integration (sequential)

| ID | Action | Goal | Files |
|----|--------|------|-------|
| W4.1 | Install @axe-core/playwright, create a11y test suite | G8 | `package.json`, `e2e/a11y.spec.ts` |
| W4.2 | Run axe-core scan, fix any remaining critical/serious violations | G9 | Various |
| W4.3 | Add a11y CI job or integrate into existing E2E job | G8 | `.github/workflows/ci.yml` |

### Wave 5 — Quality Gate + PR

| ID | Action | Goal |
|----|--------|------|
| W5.1 | Run lint, typecheck, test, build | ALL |
| W5.2 | Run full E2E suite including new a11y tests | ALL |
| W5.3 | Update INDEX.md with Plan 086 | Docs |
| W5.4 | Create branch, commit, push, create PR | PR |
| W5.5 | Monitor CI — all checks must pass | PR |

## Success Criteria

- [x] Mind map Tab key no longer traps keyboard focus
- [x] Saffron accent meets WCAG AA contrast ratio (5.0:1) in light mode
- [x] All form inputs have programmatic label associations
- [x] Dynamic content changes announced via aria-live
- [x] All framer-motion animations respect prefers-reduced-motion
- [x] All interactive elements have visible focus indicators
- [x] App has contentinfo landmark
- [x] axe-core integrated into E2E test suite
- [x] Zero axe-core critical violations across all 9 views
- [x] All existing tests pass (1048)
- [x] Lint, typecheck, build pass
- [x] PR created with all 23 CI checks passing
- [x] All PR feedback addressed

## Key Files

| File | Action |
|------|--------|
| `src/components/studio/views/mindmap-view.tsx` | Fix Tab trap |
| `src/app/globals.css` | Darken saffron for AA contrast |
| `src/components/studio/ai-harness-settings.tsx` | Fix label associations |
| `src/components/studio/views/triz-view.tsx` | Add input labels + aria-live + reduced motion |
| `src/components/studio/shared-primitives.tsx` | Fix SwitchToggle aria-label |
| `src/components/studio/right-panel.tsx` | Add aria-live for search results |
| `src/components/studio/views/ai-harness-chat.tsx` | Add aria-live for chat |
| `src/components/studio/views/editor-view.tsx` | Add validation error announcement |
| `src/components/studio/views/sync-view.tsx` | Add useReducedMotion + aria-live |
| `src/components/studio/offline-indicator.tsx` | Add useReducedMotion |
| `src/components/studio/shortcuts-dialog.tsx` | Add useReducedMotion |
| `src/components/studio/views/chat-view.tsx` | Add focus-ring |
| `src/components/studio/app-shell.tsx` | Add contentinfo landmark |
| `e2e/a11y.spec.ts` | New: axe-core test suite |
| `package.json` | Add @axe-core/playwright devDep |

---

**This is a planning artifact. No source code is modified by this document.**
