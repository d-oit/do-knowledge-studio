'use client'

/**
 * Extraction runner for the Synthesis Inbox (#1057).
 *
 * Owns the provider settings, the rate limit check and the abort controller so
 * the panel stays presentational. Proposals are handed to the caller, which
 * writes them to the proposal slice — this hook never touches the corpus.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRateLimiter } from '@/lib/ai'
import { logger } from '@/lib/logging/logger'
import { loadAISettings, type AISettings } from '@/lib/studio/ai-settings'
import {
  createExtractionSender,
  leavesDevice,
  runExtraction,
} from '@/lib/synthesis/extraction'
import type { ExtractionFailure, SynthesisProposal } from '@/lib/synthesis/types'
import type { Entity } from '@/lib/studio/types'

const log = logger.child({ area: 'ai' })

/** Failure reasons the panel can show, including the two it detects itself. */
export type SynthesisFailure = ExtractionFailure | 'rate-limited' | 'need-provider'

/** Options for {@link useSynthesisExtraction}. */
export interface UseSynthesisExtractionOptions {
  /** Note the extraction runs on, with the editor's current text. */
  note: Entity | null
  /** Corpus snapshot used to flag duplicates. */
  entities: readonly Entity[]
  /** Receives the proposals of a successful run. */
  onProposals: (proposals: SynthesisProposal[]) => void
}

/** Value returned by {@link useSynthesisExtraction}. */
export interface SynthesisExtraction {
  running: boolean
  failure: SynthesisFailure | null
  /** Configured provider, or null while settings load or when unset. */
  provider: AISettings['provider'] | null
  /** Configured model, or an empty string when unset. */
  model: string
  /** Whether the configured provider sends the note off the device. */
  sendsOffDevice: boolean
  start: () => Promise<void>
  stop: () => void
  clearFailure: () => void
}

/** Whether the provider can answer with the settings the user has entered. */
const isConfigured = (settings: AISettings): boolean =>
  settings.provider === 'local' ||
  settings.provider === 'ollama' ||
  settings.apiKey.trim() !== ''

/** Loads provider settings, the rate limit check and one extraction run. */
export const useSynthesisExtraction = ({
  note,
  entities,
  onProposals,
}: UseSynthesisExtractionOptions): SynthesisExtraction => {
  const { canRequest } = useRateLimiter()
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [running, setRunning] = useState(false)
  const [failure, setFailure] = useState<SynthesisFailure | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    void loadAISettings()
      .then((saved) => {
        if (!cancelled) setSettings(saved)
      })
      .catch((error: unknown) => {
        // A settings read failure is not fatal: the panel reports that a
        // provider still needs configuring, which is also what the user sees.
        log.warn('Could not load AI settings for extraction', { error })
      })
    return () => {
      cancelled = true
      mountedRef.current = false
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  const clearFailure = useCallback(() => {
    setFailure(null)
  }, [])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    if (mountedRef.current) setRunning(false)
  }, [])

  const start = useCallback(async () => {
    if (note === null || running) return
    if (settings === null || !isConfigured(settings)) {
      setFailure('need-provider')
      return
    }
    if (!canRequest().allowed) {
      setFailure('rate-limited')
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(true)
    setFailure(null)
    try {
      const result = await runExtraction({
        note,
        request: {
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          ollamaCpuOnly: settings.ollamaCpuOnly,
          localDevice: settings.localDevice,
        },
        entities,
        signal: controller.signal,
        send: createExtractionSender({
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          ollamaCpuOnly: settings.ollamaCpuOnly,
          localDevice: settings.localDevice,
        }),
      })
      if (controller.signal.aborted || !mountedRef.current) return
      if (!result.ok) {
        setFailure(result.reason)
        return
      }
      onProposals(result.proposals)
    } catch (error) {
      // An aborted request rejects by design; a real failure is reported with
      // one safe reason rather than the provider's error text.
      if (controller.signal.aborted || !mountedRef.current) return
      log.warn('Synthesis extraction failed', { error })
      setFailure('provider')
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      if (mountedRef.current) setRunning(false)
    }
  }, [note, running, settings, canRequest, entities, onProposals])

  return {
    running,
    failure,
    provider: settings?.provider ?? null,
    model: settings?.model ?? '',
    sendsOffDevice: settings === null ? false : leavesDevice(settings.provider),
    start,
    stop,
    clearFailure,
  }
}
