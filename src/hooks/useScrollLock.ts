import { useEffect, RefObject } from 'react';

function getScrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth;
}

export function useScrollLock(active: boolean, containerRef?: RefObject<HTMLElement>): void {
  useEffect(() => {
    if (!active) return undefined;

    function getTarget(): HTMLElement {
      if (containerRef?.current) return containerRef.current;
      return document.body;
    }

    const target = getTarget();
    const previousOverflow = target.style.overflow;
    const previousPaddingRight = target.style.paddingRight;
    const scrollbarWidth = getScrollbarWidth();

    target.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      target.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      target.style.overflow = previousOverflow;
      target.style.paddingRight = previousPaddingRight;
    };
  }, [active, containerRef]);
}
