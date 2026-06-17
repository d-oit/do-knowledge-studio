import { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab focus inside `ref` while `active` is true.
 *
 * - Captures the previously-focused element BEFORE the trap activates so
 *   focus returns correctly on close.
 * - Skips the initial focus move when the trap re-activates with the
 *   same DOM (avoids stealing focus from a child the user clicked).
 * - Tolerates React StrictMode's double-invocation by using a ref guard.
 */
export const useFocusTrap = (ref: RefObject<HTMLElement>, active: boolean) => {
  const previousFocus = useRef<HTMLElement | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!active || !ref.current) {
      // When the trap is being torn down, restore focus exactly once.
      if (initialized.current) {
        const prev = previousFocus.current;
        if (prev && document.contains(prev)) {
          // Defer to next frame so the closing overlay has unmounted.
          requestAnimationFrame(() => {
            try {
              prev.focus();
            } catch {
              // Element may have been removed from the DOM; ignore.
            }
          });
        }
        initialized.current = false;
      }
      return undefined;
    }

    // Capture the trigger focus *before* we move focus into the trap.
    // previousFocus must point to the element that opened the overlay,
    // not whatever happens to be focused when the trap activates.
    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLElement && !ref.current.contains(activeEl)) {
      previousFocus.current = activeEl;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;

      const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && current === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Only steal focus on the first activation — re-renders that change
    // `active` to true while the trap is already mounted should not
    // yank focus from a control the user is using.
    if (!initialized.current) {
      const initialFocusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const target = (initialFocusable[0] as HTMLElement | undefined) ?? ref.current;
      // Wait one frame so the overlay has laid out.
      requestAnimationFrame(() => {
        if (initialized.current) {
          try {
            target.focus({ preventScroll: true });
          } catch {
            // ignore
          }
        }
      });
      initialized.current = true;
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, ref]);

  return null;
};
