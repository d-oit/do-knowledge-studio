# 060 — E2E Test Harness with Playwright (2026-07-16)

## Summary

Expand the e2e test suite from 8 basic tests to comprehensive coverage of
keyboard navigation, accessibility, CRUD workflows, search, and command palette.
All tests use role-based selectors (no data-testid dependencies).

## Task Dependency Graph

```
Wave 0 (Independent test files — no dependencies)
├── T0.1: keyboard-navigation.spec.ts — tab order, focus trapping, shortcuts
├── T0.2: accessibility.spec.ts — ARIA roles, landmarks, color contrast basics
├── T0.3: crud-workflow.spec.ts — create/read/update/delete entity end-to-end
├── T0.4: search-and-filter.spec.ts — search, type filter, view mode toggle
└── T0.5: command-palette.spec.ts — open/close, navigation, keyboard shortcuts

Wave 1 (Enhancements — depends on Wave 0)
├── T1.1: Enhance existing home.spec.ts with mobile viewport test
├── T1.2: Enhance existing editor.spec.ts with save/edit/delete flow
└── T1.3: Add responsive.spec.ts — mobile/tablet/desktop viewport checks

Wave 2 (Quality gate — depends on Wave 1)
└── T2.1: Verify all e2e tests pass, update plans/INDEX.md
```

## Constraints

- All CI must pass (existing e2e job runs `pnpm run test:e2e`)
- No new dependencies (Playwright already installed)
- Role-based selectors preferred over data-testid
- Tests must work against `localhost:3000` dev server
- No flaky tests — use `waitFor` patterns, avoid fixed timeouts
- Max 30s timeout per test (Playwright config default)

## Verification

```bash
pnpm run test:e2e
```
