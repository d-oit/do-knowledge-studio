'use client'

import { useCallback, useEffect, useRef } from 'react'
import { saveAISettings, type AISettings } from '@/lib/studio/ai-settings'

/**
 * Trailing-edge debounce for AI-settings persistence.
 *
 * Saving settings runs an AES-GCM encryption plus an IndexedDB write, so doing
 * it on every keystroke is wasteful and, for the API-key field, writes a
 * credential on each character. Changes are coalesced into a single write
 * after {@link AI_SETTINGS_SAVE_DEBOUNCE_MS}; a pending change is flushed
 * immediately when the field/panel blurs, when the tab is hidden, and on
 * unmount, so the latest value is never dropped. The flush always persists the
 * most recent settings, never a stale snapshot captured when the timer was
 * scheduled.
 */
export const AI_SETTINGS_SAVE_DEBOUNCE_MS = 500

/** Persists AI settings with a trailing-edge debounce; see module docs. */
export const useDebouncedSettingsSave = (
  settings: AISettings,
  enabled: boolean,
  onError: (error: unknown) => void,
): void => {
  const latestRef = useRef(settings)
  const enabledRef = useRef(enabled)
  const onErrorRef = useRef(onError)

  // Refs are synced in an effect, never during render (`react-hooks/refs`): a
  // render that React discards must not publish its props to the flush path.
  // Every flush trigger — the debounce timer, blur, visibility, unmount —
  // fires after this effect has run for the latest committed render.
  useEffect(() => {
    latestRef.current = settings
    enabledRef.current = enabled
    onErrorRef.current = onError
  })

  const timerRef = useRef<number | undefined>(undefined)
  const savedSignatureRef = useRef<string | null>(null)

  const clearPendingTimer = useCallback((): void => {
    window.clearTimeout(timerRef.current)
    timerRef.current = undefined
  }, [])

  const flush = useCallback((): void => {
    clearPendingTimer()
    if (!enabledRef.current) return
    const snapshot = latestRef.current
    const signature = JSON.stringify(snapshot)
    // Skip a write whose value is already persisted (a blur flush followed by
    // the debounce timer, or React re-rendering with unrelated state).
    if (signature === savedSignatureRef.current) return
    savedSignatureRef.current = signature
    saveAISettings(snapshot)
      .then(() => {
        savedSignatureRef.current = signature
      })
      .catch((error: unknown) => {
        // A failed write is not persisted: drop the dedupe marker so the next
        // change (or flush) retries the latest value rather than silently
        // keeping it "saved" in memory only.
        if (savedSignatureRef.current === signature) savedSignatureRef.current = null
        onErrorRef.current(error)
      })
  }, [clearPendingTimer])

  const settingsSignature = JSON.stringify(settings)

  useEffect(() => {
    if (!enabled) return
    clearPendingTimer()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined
      flush()
    }, AI_SETTINGS_SAVE_DEBOUNCE_MS)
    return clearPendingTimer
  }, [enabled, settingsSignature, flush, clearPendingTimer])

  useEffect(() => {
    const flushIfHidden = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', flushIfHidden)
    document.addEventListener('focusout', flush)
    return () => {
      document.removeEventListener('visibilitychange', flushIfHidden)
      document.removeEventListener('focusout', flush)
      flush()
    }
  }, [flush])
}
