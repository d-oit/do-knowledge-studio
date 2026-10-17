'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { sendChatStream, buildMessagesAsync, useRateLimiter } from '@/lib/ai'
import { translate } from '@/lib/i18n/messages/ai'
import type { ChatMessage } from '@/lib/ai'
import type { Entity, Claim } from '@/lib/studio/types'
import type { AIProvider } from '@/lib/studio/ai-settings'
import { AppError, ErrorCode } from '@/lib/errors'
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for AI-harness chat-turn logs. */
const log = logger.child({ area: 'ai' })

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  id: 'init-assistant',
  role: 'assistant',
  content:
    'AI agent ready to assist with knowledge synthesis. Ask me anything about your local knowledge base.',
}

const RATE_LIMIT_MESSAGE =
  'I\u2019m being rate-limited \u2014 please slow down and try again in a few seconds.'

const REQUEST_TIMEOUT_MS = 120_000

/** Abort reason for a turn the provider left hanging (mirrors `AbortSignal.timeout`). */
const TIMEOUT_ABORT_REASON = 'Request timed out'

/**
 * Arms `controller` to abort after `ms`, using the same reason
 * `AbortSignal.timeout` uses.
 *
 * Deliberately built on `setTimeout` + `AbortController` rather than
 * `AbortSignal.any([controller.signal, AbortSignal.timeout(ms)])`: on an engine
 * that lacks `AbortSignal.any` that composition drops the timeout entirely, so
 * a provider that accepts the request and then goes silent would hang the turn
 * forever with only Stop as an escape (GitNexus on PR #923). This version has
 * no newer-than-ES2020 API to detect.
 *
 * Returns the timeout reader the catch block reports from, plus the clear
 * function `finally` must call so a settled turn never aborts a later one.
 */
const armRequestTimeout = (controller: AbortController, ms: number) => {
  let didTimeOut = false
  const timeoutId = setTimeout(() => {
    didTimeOut = true
    controller.abort(new DOMException(TIMEOUT_ABORT_REASON, 'TimeoutError'))
  }, ms)
  return {
    didTimeOut: () => didTimeOut,
    clear: () => { clearTimeout(timeoutId) },
  }
}

export interface UseAiHarnessChatOptions {
  provider: AIProvider
  model: string
  apiKey: string
  augment: boolean
  allowWebResearch: boolean
  ollamaCpuOnly: boolean
  ollamaBaseUrl: string
  localDevice: 'wasm' | 'webgpu'
  entities: Entity[]
  claims: Claim[]
  requiresKey: boolean
}

/**
 * Replaces the trailing assistant bubble with new content. The bubble is
 * created by the sender once the turn has content to show, so the trailing
 * message is the turn's assistant bubble whenever this is called. Both reply
 * paths (streamed deltas and a whole reply returned on the result) update that
 * same bubble.
 */
const withTrailingAssistantMessage = (
  messages: ChatMessage[],
  content: string,
): ChatMessage[] => {
  const updated = [...messages]
  const last = updated[updated.length - 1]
  updated[updated.length - 1] = { ...last, role: 'assistant', content }
  return updated
}

/**
 * Maps a send failure to localized copy, preferring the typed provider error
 * code over message text. The adapter boundary classifies HTTP/network/abort
 * failures into the `AppError` taxonomy, so the UI no longer has to guess from
 * raw provider output; the message-text branch remains for errors thrown
 * outside that boundary (e.g. research or request-building failures).
 */
const friendlyErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    if (error.code === ErrorCode.AI_PROVIDER_RATE_LIMITED) return translate('ai.chat.error.rateLimited')
    if (error.code === ErrorCode.AI_PROVIDER_TIMEOUT) return translate('ai.chat.error.timeout')
    if (error.code === ErrorCode.AI_PROVIDER_UNREACHABLE) return translate('ai.chat.error.network')
    // The taxonomy has no distinct auth code, so refine the generic provider
    // error by the adapter's structured status prefix (never the raw body).
    if (/error 401|error 403/i.test(error.message)) return translate('ai.chat.error.unauthorized')
    return translate('ai.chat.error.unexpected')
  }
  const raw = error instanceof Error ? error.message : ''
  if (/error 401|Unauthorized/i.test(raw)) return translate('ai.chat.error.unauthorized')
  if (/error 429/i.test(raw)) return translate('ai.chat.error.rateLimited')
  if (/Failed to fetch|NetworkError/i.test(raw)) return translate('ai.chat.error.network')
  return translate('ai.chat.error.unexpected')
}

/**
 * Owns the AI Harness chat session: message history, input, loading state,
 * rate limiting, the completion signal, and the streaming send pipeline. Kept
 * outside the view component so the view stays small and the send flow is
 * unit-testable.
 */
export const useAiHarnessChat = ({
  provider,
  model,
  apiKey,
  augment,
  allowWebResearch,
  ollamaCpuOnly,
  ollamaBaseUrl,
  localDevice,
  entities,
  claims,
  requiresKey,
}: UseAiHarnessChatOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [cooldownMs, setCooldownMs] = useState(0)
  // Bumped once per turn that genuinely completed (assistant content produced,
  // no abort, no provider error). `isLoading` alone cannot carry this signal:
  // it also drops when a turn fails or is stopped, so a consumer keyed on it
  // would announce those turns as successful.
  const [completedTurns, setCompletedTurns] = useState(0)
  const [failedTurns, setFailedTurns] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const { canRequest } = useRateLimiter()

  useEffect(() => {
    if (cooldownMs <= 0) return
    const timer = setTimeout(() => { setCooldownMs((ms) => Math.max(0, ms - 1000)) }, 1000)
    return () => { clearTimeout(timer) }
  }, [cooldownMs])

  // Abort any in-flight turn when the view unmounts. Without this the
  // provider stream keeps running (and keeps invoking `setMessages` on an
  // unmounted hook) until the request settles, leaking the AbortController
  // and the partially rendered transcript.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const handleSend = useCallback(async (overrideInput?: string) => {
    // Suggestion chips send explicitly via overrideInput (their click precedes
    // the setInput re-render); the composer sends its own state. Resolving the
    // text once keeps the guard, the user bubble, and the request identical.
    const text = (overrideInput ?? input).trim()
    if (!text) return
    if (requiresKey && !apiKey) {
      toast.error('Set an API key in settings to send messages.')
      return
    }

    const decision = canRequest()
    if (!decision.allowed) {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'assistant', content: RATE_LIMIT_MESSAGE },
      ])
      setCooldownMs(decision.retryAfterMs ?? 5000)
      return
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const requestTimeout = armRequestTimeout(controller, REQUEST_TIMEOUT_MS)

    try {
      const { extractUrls, fetchUrls } = await import('@/lib/ai/research')
      let researchResults: import('@/lib/ai/research').ResearchResult[] | undefined

      if (allowWebResearch) {
        const urls = extractUrls(text)
        if (urls.length > 0) {
          toast.info(`Fetching ${urls.length} URL(s)…`)
          researchResults = await fetchUrls(urls, controller.signal)
          const failed = researchResults.filter((r) => !r.success)
          if (failed.length > 0) {
            toast.warning(`Failed to fetch ${failed.length} URL(s)`)
          }
        }
      }

      const apiMessages = await buildMessagesAsync(
        messages.filter((m) => m.role !== 'system'),
        text,
        entities,
        claims,
        augment,
        researchResults,
        undefined,
        controller.signal,
      )

      // The assistant bubble is created with its first content, never as an
      // empty placeholder: a provider failure or an abort before the first
      // delta would otherwise leave a blank bubble in the transcript.
      let streamedContent = ''
      let assistantBubbleStarted = false

      const upsertAssistantBubble = (content: string) => {
        if (assistantBubbleStarted) {
          setMessages((m) => withTrailingAssistantMessage(m, content))
          return
        }
        assistantBubbleStarted = true
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content }])
      }

      const result = await sendChatStream(
        {
          provider,
          model,
          apiKey,
          messages: apiMessages,
          signal: controller.signal,
          ollamaCpuOnly,
          ollamaBaseUrl,
          localDevice,
        },
        (chunk) => {
          streamedContent += chunk
          upsertAssistantBubble(streamedContent)
        },
      )

      // A provider can answer without emitting any delta: the in-browser local
      // adapter returns the whole reply on the result when its streamer stayed
      // silent (a non-streamed fallback generation). Rendering only from
      // `onChunk` would leave the turn without a bubble, so fall back to the
      // awaited result whenever nothing was streamed.
      if (streamedContent === '' && result.content !== '') {
        upsertAssistantBubble(result.content)
      }

      // Reached only by a turn that settled normally, so this is the success
      // signal: a provider failure lands in the catch below and an abort
      // returns from it, and a turn that produced no assistant content is not
      // an answer worth announcing either.
      if (streamedContent !== '' || result.content !== '') {
        setCompletedTurns((turns) => turns + 1)
      }
    } catch (err) {
      if (requestTimeout.didTimeOut()) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `[Error] ${translate('ai.chat.error.timeout')}\n\n${translate('ai.chat.error.hint')}`,
          },
        ])
        // This branch never reaches the success signal below, which requires the
        // awaited result — so without this the quiet transcript would say nothing
        // at all about a failed turn. A partial bubble may already exist (chunks
        // are forwarded as they stream, and the reader can fail mid-stream), so
        // "failed" here means the turn did not complete, not that it produced no
        // content (review on #926).
        setFailedTurns((turns) => turns + 1)
        return
      }

      // Aborting (the turn was superseded, or generation was stopped) keeps
      // whatever already streamed and adds nothing: the bubble only exists once
      // content does, so an aborted turn never leaves an empty bubble behind.
      if (err instanceof DOMException && err.name === 'AbortError') return
      log.error('AI harness send failed', { error: err })
      const friendly = friendlyErrorMessage(err)
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'assistant', content: `[Error] ${friendly}\n\n${translate('ai.chat.error.hint')}` },
      ])
      setFailedTurns((turns) => turns + 1)
    } finally {
      requestTimeout.clear()
      setIsLoading(false)
    }
  }, [
    input,
    requiresKey,
    apiKey,
    canRequest,
    provider,
    model,
    augment,
    allowWebResearch,
    ollamaCpuOnly,
    ollamaBaseUrl,
    localDevice,
    entities,
    claims,
    messages,
  ])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    completedTurns,
    failedTurns,
    cooldownMs,
    handleSend,
    stop,
  }
}
