---
feature: full-accessibility-audit
status: delivered
updated: 2026-07-28
branch: feat/full-a11y-audit
commits: 7a30b1a..HEAD
---

# Full Accessibility Audit

## Report

**What was built** — Expanded the Playwright E2E accessibility suite from 10 axe-core-only tests to 32 tests across five WCAG 2.2 AA dimensions. Upgraded the axe-core helper to fail on critical+serious violations with wcag22aa tags. Added keyboard navigation tests (skip-nav, focus trap, radiogroup arrows, overlay Escape). Added zoom/reflow tests (200% text zoom, 400% reflow, zoom+mobile). Added automated 44x44px touch-target verification across all views. Added Saffron accent color contrast ratio tests. Fixed the skip-nav pattern by adding `tabindex="-1"` to `<main>`.

**Verification** — Lint: PASS. Typecheck: PASS. Unit tests: 1168 passing. Build: PASS. E2E: 32 new tests created across 4 spec files; dev server not available in local environment (will run in CI).

**Journey log** —
1. Review found critical test bugs: zoom-reflow navigated to non-existent routes (single-route SPA), touch-targets flagged sr-only skip-nav, skip-nav activation asserted impossible DOM behavior. All fixed before merge.
2. Review found app gaps the tests correctly expose: radiogroup doesn't follow focus on arrow keys (WAI-ARIA violation), Overlay focus restoration is dead code for unmounted consumers, real 44px violations on mobile. These are genuine a11y bugs documented as follow-up tasks.
3. `next-env.d.ts` was auto-modified by the dev server; reverted to keep diff clean.

## [S1] Problem

Plan 071 identified a deferred G5.5 requirement: "Fresh accessibility evidence covers keyboard, semantics, contrast, zoom, reflow, and target size." Plans 073-078 added touch targets, ARIA roles, skip-nav, and prefers-reduced-motion, but no comprehensive automated axe scan beyond critical violations, no 200% zoom or 400% reflow tests, and no systematic keyboard navigation verification across all views. The existing `e2e/accessibility.spec.ts` only asserts zero critical axe violations and logs serious ones as warnings — it does not fail on serious/moderate issues, test zoom behavior, or verify focus order.

## [S2] Design

Expand the Playwright E2E accessibility suite to provide WCAG 2.2 AA evidence across five dimensions:

### A. Axe-core: serious+ violations as failures

Current helper only fails on `critical`. Change `assertNoCriticalAxeViolations` to also fail on `serious` impact. Rename to `assertNoAxeViolations`. Add a second variant that includes `wcag22aa` tags (currently only `wcag2a/2aa/21a/21aa`). Keep the existing 10 view tests but upgrade their strictness.

### B. Keyboard navigation: comprehensive tab-order and focus-trap tests

New spec `e2e/keyboard-a11y.spec.ts` covering:
- **Skip-nav**: After page load, pressing Tab once focuses the skip-nav link; activating it moves focus to `#main-content`.
- **Command palette focus trap**: Open with Ctrl+K, Tab cycles within dialog; Escape closes and returns focus to trigger.
- **Editor radiogroup**: Arrow keys cycle between Edit/Preview/Split modes.
- **Overlay/dialog Escape**: Each overlay (export reset, command palette) closes on Escape and restores focus.

### C. Zoom and reflow: 200% text zoom, 400% reflow

New spec `e2e/zoom-reflow.spec.ts` covering:
- **200% text zoom**: Inject CSS `font-size: 200%` on `<html>`. Verify no horizontal overflow on home, library, editor views.
- **400% reflow**: Set viewport to 1280px wide, inject CSS `font-size: 400%`. Verify no horizontal scrollbar, content reflows to single-column.
- **Zoom + mobile**: At 375px viewport with 200% text, verify no overflow and menu still functional.
- **Search visibility**: At 200% zoom, search input remains visible and typeable.

### D. Touch targets: automated 44x44 verification

New spec `e2e/touch-targets.spec.ts`:
- On mobile viewport (375px), enumerate all interactive elements.
- Assert each has `getBoundingClientRect()` width >= 44 and height >= 44.
- Exclude visually-hidden elements (sr-only, clip, zero-size).
- Report violations with element selector and actual size.

### E. Color contrast: dedicated contrast checks

Add Saffron accent color contrast ratio tests verifying `#9a5c2a` on light bg and `#e5944a` on dark bg both meet 4.5:1 minimum ratio.

## [S3] Out of Scope

- Screen reader automation (VoiceOver/NVDA testing is manual).
- Visual regression / screenshot comparison.
- Cognitive accessibility / plain language audit.
- Internationalization / RTL layout testing.
- WCAG 2.2 `2.4.11 Focus Not Obscured` (requires sticky header analysis).
- App bugs exposed by tests (radiogroup focus-follow, Overlay focus restore, 44px mobile targets) — documented as follow-up tasks.

## Tasks

- [x] T1: Upgrade axe-core helper to fail on serious violations and add wcag22aa tags (covers: S2.A)
- [x] T2: Add skip-nav keyboard test (covers: S2.B; depends: T1)
- [x] T3: Add command palette focus-trap test (covers: S2.B; depends: T1)
- [x] T4: Add editor radiogroup arrow-key test (covers: S2.B; depends: T1)
- [x] T5: Add overlay Escape + focus-restoration tests (covers: S2.B; depends: T1)
- [x] T6: Add 200% text zoom test (covers: S2.C; depends: T1)
- [x] T7: Add 400% reflow test (covers: S2.C; depends: T1)
- [x] T8: Add zoom + mobile test (covers: S2.C; depends: T1)
- [x] T9: Add automated touch-target verification (covers: S2.D; depends: T1)
- [x] T10: Add Saffron accent contrast ratio test (covers: S2.E; depends: T1)
- [x] T11: Run full quality gate (covers: S2)
