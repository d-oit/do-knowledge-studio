'use client'

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { ViewportSize } from './graph-layout'

/**
 * The rendered size of `ref`'s element, or `null` while it is unknown.
 *
 * The graph's placement band reshapes itself to the viewport (plans/152 §6.1),
 * so the view needs a measurement the node layout cannot influence: this hook
 * reads the element's box and nothing else, which is what keeps the band from
 * feeding back into its own layout (`placeGraphNodes` never touches the DOM).
 * `ResizeObserver` pushes updates on resize, so there is no polling and no
 * `setTimeout` resample; identical measurements keep the previous object, so a
 * resize that does not change the size does not re-render.
 *
 * jsdom has no `ResizeObserver` and reports a zero-size box, so callers receive
 * `null` under unit tests and after SSR — the same shape they render today.
 */
export const useElementSize = <T extends HTMLElement>(
  ref: RefObject<T | null>,
): ViewportSize | null => {
  const [size, setSize] = useState<ViewportSize | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const measure = (): void => {
      const { clientWidth, clientHeight } = element
      setSize((current) =>
        current && current.width === clientWidth && current.height === clientHeight
          ? current
          : { width: clientWidth, height: clientHeight },
      )
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [ref])

  return size
}
