'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard, Search } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { ViewId } from '@/lib/studio/types'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { t } from '@/lib/i18n/messages/shortcuts'

interface ShortcutRow {
  keys: string
  action: string
}

const SHORTCUTS: { group: string; rows: ShortcutRow[] }[] = [
  {
    group: t('shortcuts.group.global'),
    rows: [
      { keys: '⌘K', action: t('shortcuts.action.openPalette') },
      { keys: '?', action: t('shortcuts.action.showHelp') },
      { keys: 'Esc', action: t('shortcuts.action.closeOverlay') },
    ],
  },
  {
    group: t('shortcuts.group.navigate'),
    rows: [
      { keys: 'G  H', action: t('shortcuts.action.goHome') },
      { keys: 'G  E', action: t('shortcuts.action.goEditor') },
      { keys: 'G  L', action: t('shortcuts.action.goLibrary') },
      { keys: 'G  G', action: t('shortcuts.action.goGraph') },
      { keys: 'G  M', action: t('shortcuts.action.goMindMap') },
      { keys: 'G  C', action: t('shortcuts.action.goChat') },
      { keys: 'G  A', action: t('shortcuts.action.goAi') },
      { keys: 'G  T', action: t('shortcuts.action.goTriz') },
      { keys: 'G  X', action: t('shortcuts.action.goExport') },
      { keys: 'G  S', action: t('shortcuts.action.goSync') },
    ],
  },
  {
    group: t('shortcuts.group.editor'),
    rows: [
      { keys: '⌘B', action: t('shortcuts.action.bold') },
      { keys: '⌘I', action: t('shortcuts.action.italic') },
      { keys: '⌘U', action: t('shortcuts.action.underline') },
      { keys: '⌘⇧X', action: t('shortcuts.action.strikethrough') },
      { keys: '⌘⇧H', action: t('shortcuts.action.highlight') },
      { keys: '⌘⇧M', action: t('shortcuts.action.codeBlock') },
    ],
  },
  {
    group: t('shortcuts.group.library'),
    rows: [
      { keys: '⌘F', action: t('shortcuts.action.focusSearch') },
      { keys: '⌘N', action: t('shortcuts.action.newEntity') },
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
  s: 'sync',
}

// Open state for the shortcuts dialog lives in module scope so any consumer
// (the dialog itself, the sidebar link, the keyboard listener) can read or
// toggle it without prop-drilling.
let _open = false
const listeners = new Set<(v: boolean) => void>()
/** Sets the open state of the shortcuts dialog and notifies all subscribers. */
const setOpen = (v: boolean): void => {
  _open = v
  for (const l of listeners) l(v)
}
/** Returns the current open state and a setter for the shortcuts dialog, using module-scope state. */
const useShortcutsOpen = (): [boolean, (v: boolean) => void] => {
  const [open, setLocal] = React.useState(_open)
  React.useEffect(() => {
    const l = (v: boolean) => { setLocal(v) }
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return [open, setOpen]
}

/** Keyboard shortcuts dialog with filterable grouped list and G-key navigation indicator. */
// skipcq: JS-0415, JS-R1005 — ShortcutsDialog JSX nesting and medium complexity are intentional for grouped shortcut layout
export const ShortcutsDialog = (): React.JSX.Element => {
  const [open, setOpen] = useShortcutsOpen()
  const currentView = useStudioStore((s) => s.currentView)
  const commandOpen = useStudioStore((s) => s.commandOpen)
  const mobileDrawerOpen = useStudioStore((s) => s.mobileDrawerOpen)
  const setView = useStudioStore((s) => s.setView)
  const setCommandOpen = useStudioStore((s) => s.setCommandOpen)
  const setMobileDrawerOpen = useStudioStore((s) => s.setMobileDrawerOpen)
  const reducedMotion = useReducedMotion()

  const [filter, setFilter] = React.useState('')
  const filterInputRef = React.useRef<HTMLInputElement | null>(null)

  const filteredShortcuts = React.useMemo(() => {
    if (!filter.trim()) return SHORTCUTS
    const query = filter.toLowerCase()
    return SHORTCUTS.map((section) => ({
      ...section,
      rows: section.rows.filter(
        (row) =>
          row.action.toLowerCase().includes(query) ||
          row.keys.toLowerCase().includes(query),
      ),
    })).filter((section) => section.rows.length > 0)
  }, [filter])

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
        const v = G_SEQ_MAP[key as keyof typeof G_SEQ_MAP]
        // Read currentView from the store directly to avoid stale closure
        // captures when the effect re-binds between keystrokes.
        const liveView = useStudioStore.getState().currentView
        if (v !== liveView) setView(v)
        cancelG()
      } else if (key === 'g') {
        // Pressing G twice is a no-op; keep waiting (reset the timer).
        if (gTimerRef.current) clearTimeout(gTimerRef.current)
        gTimerRef.current = setTimeout(() => { cancelG() }, 1000)
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
    setOpen,
    setView,
    setCommandOpen,
    setMobileDrawerOpen,
    cancelG,
  ])

  // Clear filter when dialog opens/closes.
  React.useEffect(() => {
    if (!open) setFilter('')
  }, [open])

  // skipcq: JS-0415
  return (
    // skipcq: JS-0415
    <>
      <Overlay
        open={open}
        onClose={() => { setOpen(false) }}
        aria-label={t('shortcuts.ariaLabel')}
        variant="center"
        closeOnEscape={false}
        initialFocusRef={closeBtnRef}
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-saffron" />
            <h2 className="font-serif text-[15px] font-semibold text-ink">
              {t('shortcuts.title')}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={() => { setOpen(false) }}
            aria-label={t('shortcuts.close')}
            className="rounded-md p-1.5 text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search filter */}
        <div className="border-b border-border px-5 py-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              ref={filterInputRef}
              type="text"
              value={filter}
              onChange={(e) => { setFilter(e.target.value); }}
              placeholder={t('shortcuts.filterPlaceholder')}
              className={cn(
                'w-full rounded-md border border-border bg-background py-1.5 pl-8 text-body-sm text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30',
                filter ? 'pr-11' : 'pr-3',
              )}
              aria-label={t('shortcuts.filterAriaLabel')}
            />
            {filter && (
              <button
                type="button"
                onClick={() => {
                  setFilter('')
                  filterInputRef.current?.focus()
                }}
                aria-label={t('shortcuts.clearFilter')}
                title={t('shortcuts.clearFilter')}
                className="absolute right-1.5 top-1/2 size-9 -translate-y-1/2 inline-flex items-center justify-center rounded text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Body — two-column grouped list */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {filteredShortcuts.length === 0 ? (
            <p className="py-8 text-center text-body-sm text-ink-mute">
              {t('shortcuts.noMatch', filter)}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {filteredShortcuts.map((section) => (
                <div key={section.group}>
                  <h3 className="mb-2 text-caption font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    {section.group}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.rows.map((row) => (
                      <li
                        key={row.keys}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-body-sm text-ink-soft">{row.action}</span>
                        <kbd
                          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-label text-ink-soft whitespace-nowrap"
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
          )}

          <p className="mt-5 border-t border-border pt-3 text-label leading-relaxed text-ink-faint">
            {t('shortcuts.tipPrefix')}<kbd className="rounded border border-border bg-muted px-1 font-mono text-caption">G</kbd>
            {t('shortcuts.tipSuffix')}
          </p>
        </div>
      </Overlay>

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
            <kbd className="rounded border border-saffron/40 bg-saffron-soft px-1.5 py-0 font-mono text-caption font-semibold text-saffron-deep">
              g
            </kbd>
            <span className="text-label font-medium text-ink-soft">{t('shortcuts.gIndicator')}</span>
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
export const ShortcutsTrigger = ({ className }: { className?: string }): React.JSX.Element => {
  const [, setOpen] = useShortcutsOpen()
  return (
    <button
      type="button"
      onClick={() => { setOpen(true) }}
      className={className}
      aria-label={t('shortcuts.triggerAria')}
      title={t('shortcuts.triggerTitle')}
    >
      <Keyboard className="h-4 w-4" />
      <span>{t('shortcuts.triggerLabel')}</span>
    </button>
  )
}
