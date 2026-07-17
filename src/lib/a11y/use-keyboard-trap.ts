'use client'

import * as React from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false
      if (el.hidden) return false
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      return true
    },
  )
}

export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
): void {
  const previousFocusRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!active || !ref.current) return

    const container = ref.current
    previousFocusRef.current = document.activeElement as HTMLElement

    const focusable = getFocusableElements(container)
    if (focusable.length > 0) {
      focusable[0].focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (previousFocusRef.current && previousFocusRef.current.focus) {
          previousFocusRef.current.focus()
        }
        return
      }

      if (e.key !== 'Tab') return

      const currentFocusable = getFocusableElements(container)
      if (currentFocusable.length === 0) return

      const first = currentFocusable[0]
      const last = currentFocusable[currentFocusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus()
      }
    }
  }, [active, ref])
}
