/**
 * Check if the user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Scroll an element into view, respecting prefers-reduced-motion.
 * Uses 'smooth' behavior unless reduced motion is preferred.
 */
export function scrollIntoViewSmooth(element: HTMLElement | null, options?: ScrollIntoViewOptions): void {
  if (!element) return;
  const behavior = prefersReducedMotion() ? 'instant' : 'smooth';
  element.scrollIntoView({ behavior, ...options });
}

/**
 * Animate a value from start to end, respecting prefers-reduced-motion.
 * Returns the final value immediately if reduced motion is preferred.
 */
export function animateWithMotionPreference(
  from: number,
  to: number,
  duration: number,
  callback: (value: number) => void,
  onEnd?: () => void
): () => void {
  if (prefersReducedMotion()) {
    callback(to);
    onEnd?.();
    return () => { /* no-op */ };
  }

  const start = performance.now();
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    callback(from + (to - from) * eased);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      onEnd?.();
    }
  };

  requestAnimationFrame(tick);
  return () => { cancelled = true; };
}
