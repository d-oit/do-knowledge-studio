'use client'

import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * React warns when `useLayoutEffect` runs during SSR (there is no layout to
 * read), but a component that also renders on the server still needs its
 * client paint to see the effect's synchronous work. This is the standard
 * isomorphic alias, used where a DOM measurement must land in the same paint
 * as the markup it measures — e.g. publishing the offline banner's height
 * before the shell reserves its space.
 */
export const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect
