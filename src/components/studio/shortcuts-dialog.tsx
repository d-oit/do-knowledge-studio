'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { ViewId } from '@/lib/studio/types'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

interface ShortcutRow {
  keys: string
  action: string
}

const SHORTCUTS: { group: string; rows: ShortcutRow[] }[] = [
  {
    group: 'Global',
    rows: [
      { keys: '⌘K', action: 'Open command palette' },
      { keys: '?', action: 'Show this help' },
      { keys: 'Esc', action: 'Close dialog / palette / drawer' },
    ],
  },
  {
    group: 'Navigate (press G, then a letter)',
    rows: [
      { keys: 'G  H', action: 'Go to Home' },
      { keys: 'G  E', action: 'Go to Editor' },
      { keys: 'G  L', action: 'Go to Library' },
      { keys: 'G  G', action: 'Go to Graph' },
      { keys: 'G  M', action: 'Go to Mind Map' },
      { keys: 'G  C', action: 'Go to Chat' },
      { keys: 'G  A', action: 'Go to AI Harness' },
      { keys: 'G  T', action: 'Go to TRIZ Matrix' },
      { keys: 'G  X', action: 'Go to Export' },
    ],
  },
]

// Map the second key of a "G then <key>" sequence to a view id. Matches the
// sidebar shortcut hints and the command palette nav items.
const G_SEQ_MAP: Record<string, ViewId> = {
  h: 'home',
  e: 'editor',
  l: 'library',
  g: 'graph',
  m: 'mindmap',
  c: 'chat',
  a: 'ai',
  t: 'triz',
  x: 'export',
}

// Open state for the shortcuts dialog lives in module scope so any consumer
// (the dialog itself, the sidebar link, the keyboard listener) can read or
// toggle it without prop-drilling.
let _open = false
const listeners = new Set<(v: boolean) => void>()
function setOpen(v: boolean) {
  _open = v
  for (const l of listeners) l(v)
}
function useShortcutsOpen(): [boolean, (v: boolean) => void] {
  const [open, setLocal] = React.useState(_open)
  React.useEffect(() => {
    const l = (v: boolean) => setLocal(v)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return [open, setOpen]
}

export function ShortcutsDialog() {
  const [open, setOpen] = useShortcutsOpen()
  const { setView, currentView, commandOpen, mobileDrawerOpen, setCommandOpen, setMobileDrawerOpen } =
    useStudioStore()
  const reducedMotion = useReducedMotion()

  // Close button ref — focused when the dialog opens.
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null)

  // Global keyboard handler: "?" toggles the dialog; the G-then-key sequence
  // is tracked here so it works regardless of focus. We deliberately ignore
  // key presses when a text input / textarea / contenteditable has focus, and
  // when the command palette is open (⌘K should not conflict).
  const gPendingRef = React.useRef<boolean>(false)
  const gTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gPending, setGPending] = React.useState(false)

  const cancelG = React.useCallback(() => {
    gPendingRef.current = false
    setGPending(false)
    if (gTimerRef.current) {
      clearTimeout(gTimerRef.current)
      gTimerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      if (el.isContentEditable) return true
      return false
    }

    const handler = (e: KeyboardEvent) => {
      // Escape — close whichever overlay is open, topmost first.
      if (e.key === 'Escape') {
        if (open) {
          setOpen(false)
          return
        }
        if (commandOpen) {
          setCommandOpen(false)
          return
        }
        if (mobileDrawerOpen) {
          setMobileDrawerOpen(false)
          return
        }
        return
      }

      // "?" (Shift+/ on US layouts, or directly on some) opens the dialog.
      // Ignore when typing in an input.
      if (e.key === '?' && !isTypingTarget(e.target) && !commandOpen && !open) {
        e.preventDefault()
        setOpen(true)
        return
      }

      // G-then-key navigation. Only when no overlay is open and not typing.
      if (commandOpen || open || mobileDrawerOpen) return
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      if (!gPendingRef.current) {
        if (key === 'g') {
          gPendingRef.current = true
          setGPending(true)
          if (gTimerRef.current) clearTimeout(gTimerRef.current)
          gTimerRef.current = setTimeout(() => {
            cancelG()
          }, 1000)
          e.preventDefault()
        }
        return
      }

      // We have a pending "g" — wait for the second key.
      if (key in G_SEQ_MAP) {
        e.preventDefault()
        const v = G_SEQ_MAP[key]
        // Read currentView from the store directly to avoid stale closure
        // captures when the effect re-binds between keystrokes.
        const liveView = useStudioStore.getState().currentView
        if (v !== liveView) setView(v)
        cancelG()
      } else if (key === 'g') {
        // Pressing G twice is a no-op; keep waiting (reset the timer).
        if (gTimerRef.current) clearTimeout(gTimerRef.current)
        gTimerRef.current = setTimeout(() => cancelG(), 1000)
      } else {
        // Any other key cancels the sequence.
        cancelG()
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (gTimerRef.current) clearTimeout(gTimerRef.current)
    }
  }, [
    open,
    commandOpen,
    mobileDrawerOpen,
    currentView,
    setView,
    setCommandOpen,
    setMobileDrawerOpen,
    cancelG,
  ])

  // Move focus to the close button on open. Cleanup on close.
  React.useEffect(() => {
    if (open) {
      // Defer to next frame so the button is mounted.
      const id = requestAnimationFrame(() => {
        closeBtnRef.current?.focus()
      })
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="shortcuts-backdrop"
            className="fixed inset-0 z-[850] flex items-center justify-center bg-ink/30 backdrop-blur-sm"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          >
            <motion.div
              key="shortcuts-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-saffron" />
                  <h2 className="font-serif text-[15px] font-semibold text-ink">
                    Keyboard shortcuts
                  </h2>
                </div>
                <button
                  ref={closeBtnRef}
                  onClick={() => setOpen(false)}
                  aria-label="Close shortcuts dialog"
                  className="rounded-md p-1.5 text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body — two-column grouped list */}
              <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  {SHORTCUTS.map((section) => (
                    <div key={section.group}>
                      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                        {section.group}
                      </h3>
                      <ul className="space-y-1.5">
                        {section.rows.map((row) => (
                          <li
                            key={row.keys}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-[13px] text-ink-soft">{row.action}</span>
                            <kbd
                              className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-soft whitespace-nowrap"
                              aria-label={row.keys}
                            >
                              {row.keys}
                            </kbd>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <p className="mt-5 border-t border-border pt-3 text-[11px] leading-relaxed text-ink-faint">
                  Tip: the <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">G</kbd>{' '}
                  sequence waits 1 second for the next key — if you change your mind, just wait or press any other key to cancel.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "g…" indicator pill — bottom-left, dismisses on navigation or timeout */}
      <AnimatePresence>
        {gPending && (
          <motion.div
            key="g-indicator"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
            className={cn(
              'fixed bottom-4 left-4 z-[700] flex items-center gap-2 rounded-full border border-saffron/40 bg-popover px-3 py-1.5 shadow-lifted',
            )}
            aria-live="polite"
          >
            <kbd className="rounded border border-saffron/40 bg-saffron-soft px-1.5 py-0 font-mono text-[10px] font-semibold text-saffron-deep">
              g
            </kbd>
            <span className="text-[11px] font-medium text-ink-soft">Press a key…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * Convenience hook + component for triggering the dialog from anywhere.
 * The sidebar uses this to render its "Keyboard shortcuts" link without
 * needing to know about the dialog's internal state.
 */
export function ShortcutsTrigger({ className }: { className?: string }) {
  const [, setOpen] = useShortcutsOpen()
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={className}
      aria-label="Show keyboard shortcuts"
      title="Keyboard shortcuts (?)"
    >
      <Keyboard className="h-4 w-4" />
      <span>Shortcuts</span>
    </button>
  )
}
