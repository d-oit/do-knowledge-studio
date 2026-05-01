import { useEffect, useRef, RefObject } from 'react';

export const useFocusTrap = (ref: RefObject<HTMLElement>, active: boolean) => {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (active) {
      previousFocus.current = document.activeElement as HTMLElement;

      const focusableElementsSelector =
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (!ref.current) return;

        const focusableElements = ref.current.querySelectorAll<HTMLElement>(focusableElementsSelector);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      // Auto-focus first element
      const focusableElements = ref.current?.querySelectorAll<HTMLElement>(focusableElementsSelector);
      if (focusableElements && focusableElements.length > 0) {
        focusableElements[0].focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousFocus.current?.focus();
      };
    }
  }, [active, ref]);
};
