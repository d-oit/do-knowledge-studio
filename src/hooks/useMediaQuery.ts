import { useState, useEffect } from 'react';

/**
 * Hook to listen for media query changes.
 * @param query Media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the query matches
 */
function createMediaListener(setter: (v: boolean) => void): (e: MediaQueryListEvent) => void {
  return (e: MediaQueryListEvent) => { setter(e.matches); };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = createMediaListener(setMatches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
