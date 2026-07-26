# ADR 014: Shared Overlay/Modal Accessibility Primitive

## Status
IMPLEMENTED (2026-07-26) — Shared `<Overlay>` component in `src/components/studio/ui/shared-primitives.tsx` with focus trap, Escape key, backdrop click, ARIA attributes, initialFocusRef, body scroll lock, and 4 variants (center, sheet-bottom, sheet-left, fullscreen). Migrated: command-palette, mobile-drawer, shortcuts-dialog, import-preview-dialog, reset-confirm-dialog, encrypt-export-dialog, delete-confirm (right-panel). Search listbox semantics fixed. Dead useFocusTrap hook removed.

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
Introduce **one shared `<Overlay>` primitive** that all modal/drawer/sheet surfaces use. It encapsulates the full accessibility contract.

### API
```tsx
type OverlayVariant = 'center' | 'sheet-bottom' | 'sheet-left' | 'fullscreen';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  'aria-label'?: string;           // accessible label for the dialog
  'aria-labelledby'?: string;      // id of the element that labels the dialog
  variant?: OverlayVariant;        // default 'center'
  closeOnBackdrop?: boolean;       // default true
  closeOnEscape?: boolean;         // default true
  trapFocus?: boolean;             // default true
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  children: React.ReactNode;
}
```

### Accessibility contract (every overlay)
1. Backdrop is a **non-focusable** `div`; click closes when `closeOnBackdrop`.
2. Content container is `role="dialog"` `aria-modal="true"` with `aria-labelledby` or `aria-label`.
3. **Focus trap** while open (inline implementation, cached on open).
4. **Escape** closes (inline `onKeyDown` handler with `stopPropagation`).
5. **Background scroll lock** with ref-counting for nested overlays (set `overflow: hidden` + compensate scrollbar width, restore on last overlay close).
6. **Focus restoration** to the previously focused element on close.
7. Responsive sizing from variant: center (`width: min(100%-2rem, 32rem)`), sheet-bottom (full-width, rounded-t), sheet-left (86vw/340px, h-dvh), fullscreen.
8. `prefers-reduced-motion` handled by Tailwind `animate-in` classes (see ADR 013).

### Migration targets
Refactor onto `<Overlay>`: mobile search overlay, `CommandPalette`, `SettingsWizard`, `EntityReviewDialog`, `MobileDrawer` (variant `sheet-left`), `SnapshotBrowserModal`, `SaveSnapshotModal`, graph mobile inspector bottom-sheet (ADR 015).

### Related semantic cleanups (G-A11Y)
- Search results: `role="group"` with `aria-label` for navigation lists containing buttons (not `role="listbox"` which implies selectable options).
- Command-palette: cmdk library handles `aria-activedescendant` natively — no changes needed.
- Editor toolbar: `aria-expanded` on Advanced toggle (action buttons, not stateful toggles).`aria-pressed` used on toggle buttons in right-panel, mobile-drawer, library-view, graph-view, triz-view, mindmap-view.

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
- Implemented inline in `src/components/studio/ui/shared-primitives.tsx` (Overlay component).
- Scroll lock uses module-level ref-counting for nested overlay support.
- Focus trap caches focusable elements on open for performance.
- Keep each refactored component under 500 LOC; extract sub-views if needed.
- Verification: unit tests for focus-trap + Escape + scroll-lock + variant classes; E2E that Tab cannot leave an open overlay and focus returns to the trigger on close.

## Files Affected (implementation)
- NEW `src/components/Overlay.tsx`, `src/hooks/useScrollLock.ts`
- `src/components/MobileDrawer.tsx`, `src/components/CommandPalette.tsx`
- `src/features/ai/SettingsWizard.tsx`, `src/features/ai/EntityReviewDialog.tsx`
- `src/features/graph/SnapshotBrowserModal.tsx`, `src/features/graph/SaveSnapshotModal.tsx`
- `src/app/App.tsx` (mobile search overlay)
- `src/features/editor/EditorToolbar.tsx`, `src/features/search/SearchPanel.tsx`, `src/features/library/LibraryView.tsx` (semantic cleanups)
