# ADR 014: Shared Overlay/Modal Accessibility Primitive

## Status
PARTIALLY IMPLEMENTED (2026-07-25) — Shared `<Overlay>` component created in `src/components/studio/ui/shared-primitives.tsx` with focus trap, Escape key, backdrop click, ARIA attributes, initialFocusRef, and body scroll lock. Migrated to by `export-view.tsx` (3 dialogs). Remaining: variant support (sheet-bottom, sheet-left, fullscreen), migration of other overlay surfaces (CommandPalette, MobileDrawer, SettingsWizard).

## Context
The app has several overlay surfaces with **inconsistent accessibility and behavior** (verified):

| Surface | Focus trap | Escape | Scroll lock | Dialog role | Evidence |
|---------|-----------|--------|-------------|-------------|----------|
| `MobileDrawer` | ✅ `useFocusTrap` | ✅ `useEscapeKey` | ❌ | overlay is `role="button"` wrapping nested `role="dialog"` | `src/components/MobileDrawer.tsx:15-16,102-117` |
| `SnapshotBrowserModal` | ✅ | ✅ | ❌ | `role="dialog"` `aria-modal` | `src/features/graph/SnapshotBrowserModal.tsx:33-34,109-116` |
| Mobile search overlay | ❌ | ❌ | ❌ | none at wrapper | `src/app/App.tsx:299-308` |
| `CommandPalette` | ❌ | partial | ❌ | overlay `role="button"`, modal `role="presentation"` | `src/components/CommandPalette.tsx:126-139` |
| `SettingsWizard` | ❌ | ❌ | ❌ | none (inline styles) | `src/features/ai/SettingsWizard.tsx:30-41` |
| `EntityReviewDialog` | ❌ | ❌ | ✅ internal scroll | `role="dialog"` `aria-modal` | `src/features/ai/EntityReviewDialog.tsx:63-81` |

Problems:
- Keyboard users can tab **behind** the mobile search overlay, command palette, and settings wizard.
- Backdrops exposed as `role="button"` create a confusing extra focus stop and wrap interactive subtrees.
- No background scroll-lock, so the page scrolls under open overlays on mobile.
- Modals lack responsive width / `max-height` / safe-area padding, so tall content (settings, diff) can be unreachable on phones.
- Focus is not restored to the invoking element on close.

There is duplicated logic (`useFocusTrap`, `useEscapeKey`) and missing logic (scroll lock) spread unevenly across components.

## Decision
Introduce **one shared `<Overlay>` primitive** (plus a `useScrollLock` hook) that all modal/drawer/sheet surfaces use. It encapsulates the full accessibility contract.

### API
```tsx
interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy?: string;          // id of the title element
  ariaLabel?: string;           // fallback when no title element
  variant?: 'center' | 'sheet-bottom' | 'sheet-left' | 'fullscreen';
  initialFocusRef?: React.RefObject<HTMLElement>;
  closeOnBackdrop?: boolean;    // default true
  children: React.ReactNode;
}
```

### Accessibility contract (every overlay)
1. Backdrop is a **non-focusable** `div` (not `role="button"`); click closes when `closeOnBackdrop`.
2. Content container is `role="dialog"` `aria-modal="true"` with `aria-labelledby` or `aria-label`.
3. **Focus trap** while open (reuse existing `useFocusTrap`).
4. **Escape** closes (reuse existing `useEscapeKey`).
5. **Background scroll lock** via new `useScrollLock` (set `overflow: hidden` + compensate scrollbar width, restore on close).
6. **Focus restoration** to the previously focused element on close.
7. Responsive sizing from variant: `width: min(100% - 2rem, <max>)`, `max-height: calc(100dvh - 2rem)`, `overflow-y: auto`, `padding-bottom: env(safe-area-inset-bottom)`.
8. Respects `prefers-reduced-motion` for enter/exit (see ADR 013).

### Migration targets
Refactor onto `<Overlay>`: mobile search overlay, `CommandPalette`, `SettingsWizard`, `EntityReviewDialog`, `MobileDrawer` (variant `sheet-left`), `SnapshotBrowserModal`, `SaveSnapshotModal`, graph mobile inspector bottom-sheet (ADR 015).

### Related semantic cleanups (G-A11Y)
- Command-palette listbox: keep DOM focus on the input; use `aria-activedescendant` only; options not individually tabbable (`CommandPalette.tsx:400-415`).
- Editor toolbar toggles get `aria-pressed` (`EditorToolbar.tsx:26-145`).
- Search virtualization: fix `ul > div > li` nesting to valid `listbox`/`option` markup (`SearchPanel.tsx:316-351`).
- Library row: prefer native `<button>` row or a single action button instead of `div role="button"` containing a nested button (`LibraryView.tsx:175-215`).

## Alternatives Considered
- **A headless dialog library (e.g. Radix/Headless UI)**: rejected — adds a dependency; existing `useFocusTrap`/`useEscapeKey` already cover most needs; local-first/minimal-deps preference.
- **Native `<dialog>` element**: considered; inconsistent styling/scroll-lock control and focus behavior across the variants (bottom sheet, fullscreen). Revisit later; not blocking.
- **Fix each overlay independently**: rejected — perpetuates drift and duplicated logic.

## Consequences
### Positive
- Uniform, correct keyboard and screen-reader behavior across all overlays.
- Background scroll-lock and safe-area handling fix mobile usability.
- Less duplicated logic; new overlays inherit correct behavior by default.

### Negative
- Refactor touches many components in one wave; needs E2E coverage to avoid regressions.

## Implementation Notes
- New files: `src/components/Overlay.tsx`, `src/hooks/useScrollLock.ts` (+ tests).
- Reuse existing `useFocusTrap`, `useEscapeKey` hooks.
- Keep each refactored component under 500 LOC; extract sub-views if needed.
- Verification: unit tests for focus-trap + Escape + scroll-lock; E2E that Tab cannot leave an open overlay and focus returns to the trigger on close.

## Files Affected (implementation)
- NEW `src/components/Overlay.tsx`, `src/hooks/useScrollLock.ts`
- `src/components/MobileDrawer.tsx`, `src/components/CommandPalette.tsx`
- `src/features/ai/SettingsWizard.tsx`, `src/features/ai/EntityReviewDialog.tsx`
- `src/features/graph/SnapshotBrowserModal.tsx`, `src/features/graph/SaveSnapshotModal.tsx`
- `src/app/App.tsx` (mobile search overlay)
- `src/features/editor/EditorToolbar.tsx`, `src/features/search/SearchPanel.tsx`, `src/features/library/LibraryView.tsx` (semantic cleanups)
