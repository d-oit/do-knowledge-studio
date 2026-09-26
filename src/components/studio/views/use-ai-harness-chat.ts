'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { sendChatStream, buildMessagesAsync, useRateLimiter } from '@/lib/ai'
import type { ChatMessage } from '@/lib/ai'
import type { Entity, Claim } from '@/lib/studio/types'
import type { AIProvider } from '@/lib/studio/ai-settings'

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'AI agent ready to assist with knowledge synthesis. Ask me anything about your local knowledge base.',
}

const RATE_LIMIT_MESSAGE =
  'I\u2019m being rate-limited \u2014 please slow down and try again in a few seconds.'

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
  updated[updated.length - 1] = { role: 'assistant', content }
  return updated
}

/**
 * Owns the AI Harness chat session: message history, input, loading state,
 * rate limiting, and the streaming send pipeline. Kept outside the view
 * component so the view stays small and the send flow is unit-testable.
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
  const abortRef = useRef<AbortController | null>(null)
  const { canRequest } = useRateLimiter()

  useEffect(() => {
    if (cooldownMs <= 0) return
    const timer = setTimeout(() => { setCooldownMs((ms) => Math.max(0, ms - 1000)) }, 1000)
    return () => { clearTimeout(timer) }
  }, [cooldownMs])

  const handleSend = useCallback(async () => {
    if (!input.trim()) return
    if (requiresKey && !apiKey) {
      toast.error('Set an API key in settings to send messages.')
      return
    }

    const decision = canRequest()
    if (!decision.allowed) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: RATE_LIMIT_MESSAGE },
      ])
      setCooldownMs(decision.retryAfterMs ?? 5000)
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const { extractUrls, fetchUrls } = await import('@/lib/ai/research')
      let researchResults: import('@/lib/ai/research').ResearchResult[] | undefined

      if (allowWebResearch) {
        const urls = extractUrls(input)
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
        input,
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
        setMessages((m) => [...m, { role: 'assistant', content }])
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
    } catch (err) {
      // Aborting (the turn was superseded, or generation was stopped) keeps
      // whatever already streamed and adds nothing: the bubble only exists once
      // content does, so an aborted turn never leaves an empty bubble behind.
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `[Error] ${msg}\n\nCheck your provider settings and try again.` },
      ])
    } finally {
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

  return { messages, setMessages, input, setInput, isLoading, cooldownMs, handleSend }
}
