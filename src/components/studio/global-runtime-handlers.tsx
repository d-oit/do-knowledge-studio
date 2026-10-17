'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logging/logger'

/**
 * Global runtime failure handlers (ADR 035, Plan 130 A4).
 *
 * React boundaries only see what React renders. An uncaught asynchronous
 * rejection — a failed `await` in a store migration, a speech or sync promise
 * nobody awaited — has no boundary, and before this component it vanished
 * silently: no console line, no ring-buffer entry, nothing to correlate with
 * the warning that preceded it. These two listeners close that gap so every
 * failure path lands in the one stream the logger owns.
 *
 * Deduplication matters because a runtime failure is usually a loop: one broken
 * timer rejects every tick, and 60 identical entries per second would push the
 * actual first cause out of the bounded buffer. Identical messages inside
 * `DEDUP_WINDOW_MS` are reported once.
 *
 * Mounted once in the app shell; `AppShell` is the only client root the app
 * has, so one mount covers every view.
 */

/** Tag these entries carry, so support can tell runtime failures from view ones. */
const AREA = 'global'

const log = logger.child({ area: AREA })

/** Identical failures inside this window are reported once. */
const DEDUP_WINDOW_MS = 5_000

/** Distinct messages remembered before the window map is reset. */
const MAX_TRACKED_MESSAGES = 50

/** What a listener hands to the logger, after normalization. */
interface FailureReport {
  /** Dedup key and entry message. Empty means there is nothing to report. */
  readonly message: string
  /** Structured context such as the throwing error's name and stack. */
  readonly data?: Record<string, unknown>
}

/**
 * Normalizes a rejected value or thrown error into a message plus data.
 * @param value - The rejection reason or thrown value, whatever its type.
 * @returns The message to dedup on, plus structured context when it exists.
 */
const describeFailure = (value: unknown): FailureReport => {
  if (value instanceof Error) {
    return { message: value.message, data: { name: value.name, stack: value.stack } }
  }
  if (typeof value === 'string') return { message: value }
  return { message: 'Failure without an Error value', data: { value } }
}

/**
 * One-shot-per-window gate keyed by message. A Map is what this needs: keys
 * arrive at runtime, and the size guard exists so a storm of *distinct*
 * messages cannot grow it without bound.
 * @returns A predicate that is `true` once per message per window.
 */
const createDeduper = (): ((message: string) => boolean) => {
  const lastSeenAt = new Map<string, number>()
  return (message) => {
    const now = Date.now()
    const previous = lastSeenAt.get(message)
    if (previous !== undefined && now - previous < DEDUP_WINDOW_MS) return false
    if (lastSeenAt.size >= MAX_TRACKED_MESSAGES) lastSeenAt.clear()
    lastSeenAt.set(message, now)
    return true
  }
}

/** Subscribes window runtime failures to the logger until unmount. */
export const GlobalRuntimeHandlers = (): null => {
  useEffect(() => {
    const isFirstReport = createDeduper()

    const report = (source: string, failure: FailureReport): void => {
      // An empty message means neither a JS error nor a message: this is a
      // resource load failure (a 404'd image, a blocked font), which is not a
      // runtime failure and has nothing actionable to record.
      if (failure.message === '' || !isFirstReport(failure.message)) return
      log.error(failure.message, { source, ...failure.data })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      report('unhandledrejection', describeFailure(event.reason))
    }

    const onError = (event: ErrorEvent): void => {
      report('error', describeFailure(event.error ?? event.message))
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onError)
    }
  }, [])

  return null
}
