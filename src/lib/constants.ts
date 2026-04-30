/**
 * Responsive Breakpoints
 */
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1200,
} as const;

/**
 * Media Queries
 */
export const MEDIA_QUERIES = {
  MOBILE: `(max-width: ${BREAKPOINTS.MOBILE}px)`,
  TABLET: `(max-width: ${BREAKPOINTS.TABLET}px)`,
  DESKTOP: `(max-width: ${BREAKPOINTS.DESKTOP}px)`,
} as const;
