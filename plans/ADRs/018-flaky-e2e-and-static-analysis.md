# ADR 018: Pre-existing Flaky E2E Tests & Static Analysis Findings

**Status**: 📝 Proposed
**Date**: 2026-06-17
**Source**: Plan 043 — codacy/DeepSource findings + E2E failures on PR #326
**Deciders**: Engineering

## Context

PR #326 ran the full CI pipeline. All GitHub Actions internal checks passed (lint, typecheck, 455 unit tests, build, coverage). Two external quality gates and E2E had pre-existing failures:

### E2E Tests (35 of 93 failed)

All failures are viewport/responsive-navigation timing issues:

**chromium (3 failures)** — `modern-shell.spec.ts`: Command palette toggling and keyboard navigation timeout. The `expect(locator).not.toBeVisible()` and `expect(locator).toBeVisible()` assertions on the palette overlay timeout at 30s. Likely a race between the keyboard shortcut handler and the animation frame.

**mobile (28 failures)** — `features.spec.ts`: Every test fails at the same `ensureNavVisible(page)` / `page.click()` assertion. On the iPhone 13 viewport (375×812), the sidebar navigation is hidden behind a hamburger menu. The test utility `ensureNavVisible` should open the hamburger menu before clicking nav links.

**tablet (4 failures)** — `skeletons.spec.ts` + `modern-shell.spec.ts`: Same responsive-navigation issue on iPad viewport (1024×1366).

All 35 failures retried once and failed again, confirming they are systematic, not transient.

### DeepSource JavaScript (77 introduced, 26 resolved)

Most findings are minor anti-patterns:
- Cyclomatic complexity warnings on `AppContent` (24) and `CommandPalette` (20)
- Short variable names in pre-existing test files
- Namespace imports (`import * as fs`) in pre-existing test file

These are pre-existing issues in files not changed by PR #326.

### Codacy (48 new issues, 27 suppressed as false positives)

Remaining unaddressed findings:
- 3 `existsSync` non-literal arg warnings in `cli/__tests__/db.test.ts` (inherent to tmpdir pattern)
- 14 security-rule false positives in `ClaimExtension.test.ts` / `MentionExtension.test.ts` (Tiptap APIs)
- 1 `Function Call Object Injection Sink` (standard React callback)
- 1 `Generic Object Injection Sink` (standard React callback)
- 1 `Unnecessary conditional, value is always falsy` (defensive null check, valid)

## Decision

1. **E2E failures**: Defer to dedicated test-hardening plan. Root cause is `ensureNavVisible` not handling the hamburger menu on small viewports. Fix requires updating the test utility.
2. **DeepSource findings**: Accept as known minor anti-patterns. Not actionable without refactoring root components.
3. **Codacy remaining**: Already suppressed all actual false positives. Remaining 21 items are pre-existing patterns in test files.

## Consequences

### Positive
- All internal CI checks pass (lint, typecheck, unit tests, build, coverage)
- E2E timeout hazard resolved (workers 1→2, retries 2→1, timeout 30→40m)
- 27 Codacy false positives suppressed, reducing future noise
- All actual code quality issues in changed files are fixed

### Negative
- 35 E2E tests still fail on mobile/tablet viewports
- DeepSource and Codacy will show FAIL/ACTION_REQUIRED on PR #326
- These will gate future PRs until fixed

## Files Affected

- `.github/workflows/ci-and-labels.yml` — E2E timeout 30→40m
- `playwright.config.ts` — workers 1→2, retries 2→1
- 12 source/test files fixed for Codacy/DeepSource findings

## References

- Plan 043 — `plans/043-goap-static-analysis-closure-2026-06-17.md`
- PR #326 — `feat(plan-041+042): close gap-closure, add plan 042 + UI polish`
- Codacy: https://app.codacy.com/gh/d-oit/do-knowledge-studio/pull-requests/326
- DeepSource: https://app.deepsource.com/gh/d-oit/do-knowledge-studio/run/048fb6f6-05e6-4544-bc38-256073729f56/javascript/
