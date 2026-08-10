'use client'

import { useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

type OverlayVariant = 'center' | 'sheet-bottom' | 'sheet-left' | 'fullscreen'

interface OverlayProps {
  open: boolean
  onClose: () => void
  /** Accessible label for the dialog */
  'aria-label'?: string
  /** ID of the element that labels the dialog */
  'aria-labelledby'?: string
  /** Visual variant */
  variant?: OverlayVariant
  /** Whether clicking the backdrop closes the dialog */
  closeOnBackdrop?: boolean
  /** Whether pressing Escape closes the dialog */
  closeOnEscape?: boolean
  /** Whether to trap focus within the dialog */
  trapFocus?: boolean
  /** Ref to the element that should receive initial focus */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  className?: string
  children: React.ReactNode
}

const CENTER_CONTAINER =
  'm-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,32rem)] overflow-y-auto rounded-xl'
const SHEET_BOTTOM_CONTAINER =
  'mx-auto mt-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-t-xl'
const SHEET_LEFT_CONTAINER = 'h-dvh w-[min(86vw,340px)] overflow-y-auto'
const FULLSCREEN_CONTAINER = 'h-full w-full overflow-y-auto'

const getBackdropClasses = (variant: OverlayVariant): string => {
  switch (variant) {
    case 'sheet-left':
    case 'fullscreen':
      return 'flex'
    case 'center':
    case 'sheet-bottom':
    default:
      return ''
  }
}

const getAnimationClasses = (variant: OverlayVariant): string => {
  switch (variant) {
    case 'center':
      return 'slide-in-from-bottom-4'
    case 'sheet-bottom':
      return 'slide-in-from-bottom-full'
    case 'sheet-left':
      return 'slide-in-from-left-full'
    case 'fullscreen':
    default:
      return ''
  }
}

const getVariantClasses = (variant: OverlayVariant): string => {
  switch (variant) {
    case 'center':
      return CENTER_CONTAINER
    case 'sheet-bottom':
      return SHEET_BOTTOM_CONTAINER
    case 'sheet-left':
      return SHEET_LEFT_CONTAINER
    case 'fullscreen':
      return FULLSCREEN_CONTAINER
    default:
      return CENTER_CONTAINER
  }
}

let scrollLockCount = 0
let savedScrollbarWidth = 0

const lockBodyScroll = () => {
  if (scrollLockCount === 0) {
    savedScrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${savedScrollbarWidth}px`
  }
  scrollLockCount++
}

const unlockBodyScroll = () => {
  scrollLockCount--
  if (scrollLockCount === 0) {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  }
}

const useBodyScrollLock = (open: boolean) => {
  useEffect(() => {
    if (!open) return undefined
    lockBodyScroll()
    return unlockBodyScroll
  }, [open])
}

const trapFocusWithinOverlay = (event: React.KeyboardEvent, focusable: HTMLElement[]) => {
  const first = focusable.at(0)
  const last = focusable.at(-1)
  const target = event.shiftKey ? first : last
  const destination = event.shiftKey ? last : first
  if (document.activeElement !== target) return
  event.preventDefault()
  destination?.focus()
}

const cacheFocusableElements = (container: HTMLDivElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  )

const focusOverlay = (
  container: HTMLDivElement,
  initialFocusRef: React.RefObject<HTMLElement | null> | undefined,
  focusableCacheRef: React.MutableRefObject<HTMLElement[]>,
) => {
  focusableCacheRef.current = cacheFocusableElements(container)
  const target = initialFocusRef?.current ?? focusableCacheRef.current.at(0)
  ;(target ?? container).focus()
}

const restoreOverlayFocus = (
  previousFocusRef: React.MutableRefObject<HTMLElement | null>,
  focusableCacheRef: React.MutableRefObject<HTMLElement[]>,
) => {
  focusableCacheRef.current = []
  previousFocusRef.current?.focus()
  previousFocusRef.current = null
}

const useOverlayFocus = (
  open: boolean,
  initialFocusRef: React.RefObject<HTMLElement | null> | undefined,
  containerRef: React.RefObject<HTMLDivElement | null>,
) => {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const focusableCacheRef = useRef<HTMLElement[]>([])

  useEffect(() => {
    if (open) {
      const activeElement = document.activeElement
      previousFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null
      const container = containerRef.current
      if (container) focusOverlay(container, initialFocusRef, focusableCacheRef)
      return undefined
    }
    restoreOverlayFocus(previousFocusRef, focusableCacheRef)
    return undefined
  }, [open, initialFocusRef, containerRef])

  return focusableCacheRef
}

/** Accessible modal overlay with focus trap, scroll lock, and configurable layout variant. */
export const Overlay = ({
  open,
  onClose,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  variant = 'center',
  closeOnBackdrop = true,
  closeOnEscape = true,
  trapFocus = true,
  initialFocusRef,
  className,
  children,
}: OverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  useBodyScrollLock(open)
  const focusableCacheRef = useOverlayFocus(open, initialFocusRef, containerRef)

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (trapFocus && event.key === 'Tab') {
        trapFocusWithinOverlay(event, focusableCacheRef.current)
      }
    },
    [closeOnEscape, onClose, trapFocus],
  )

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (closeOnBackdrop && event.target === event.currentTarget) onClose()
    },
    [closeOnBackdrop, onClose],
  )

  if (!open) return null

  return (
    <div
      onClick={handleBackdropClick}
      className={cn(
        'fixed inset-0 z-[800] bg-ink/30 backdrop-blur-sm animate-in fade-in duration-150',
        getBackdropClasses(variant),
      )}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'animate-in fade-in duration-150',
          getVariantClasses(variant),
          getAnimationClasses(variant),
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
