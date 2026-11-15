## LESSON-033: Absolute Overlay Clear Button Clearance and Native Config Deprecation Forward-Compat

**Date**: 2026-09-01
**Component**: UI Primitives / Shortcuts Dialog / Vitest
**Severity**: Medium

**Issue**: When adding an absolute-positioned clear button inside an input, text clipping can occur if right padding matches button width alone rather than total extent (`button width + right offset + margin`). Additionally, `vitest.config.ts` using `__dirname` produces future deprecation notices under native config loading.

**Symptoms**:
- Filter text in `ShortcutsDialog` clips under `size-9` (36px) clear button when right padding is `pr-8` (32px).
- Deprecation warning on Vitest run: `Your Vite config uses features that are unsupported by configLoader: 'native'`.

**Root Cause**:
- `pr-8` (2rem / 32px) was insufficient for `right-1.5` (6px) + `size-9` (36px) = 42px bounding box, leaving a 10px overlap zone.
- CJS global `__dirname` in `vitest.config.ts` requires `import.meta.dirname` in modern ESM environments.

**Solution**:
- Expanded conditional right padding to `pr-11` (44px / 2.75rem), ensuring 2px clear margin beyond the 42px button boundary.
- Verified synchronous filter reset and tested rapid type $\rightarrow$ clear $\rightarrow$ Escape dismiss cycle.
- Filed GitHub issue for Vitest `import.meta.dirname` migration.

**Prevention**:
- Always calculate input clearance padding as `right_offset + element_width + clearance_margin`.
- Maintain test assertions on conditional padding classes (`pr-3` vs `pr-11`) for filter inputs.

**Tags**: #ui #accessibility #padding #shortcuts #dialog #clear-button #vitest

---
