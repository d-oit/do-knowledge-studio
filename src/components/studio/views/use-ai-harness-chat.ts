'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { sendChatStream, buildMessages, useRateLimiter } from '@/lib/ai'
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

interface UseAiHarnessChatOptions {
  provider: AIProvider
  model: string
  apiKey: string
  augment: boolean
  allowWebResearch: boolean
  ollamaCpuOnly: boolean
  ollamaBaseUrl: string
  entities: Entity[]
  claims: Claim[]
  requiresKey: boolean
}

/**
 * Owns the AI Harness chat session: message history, input, loading state,
 * rate limiting, and the streaming send pipeline. Kept outside the view
 * component so the view stays small and the send flow is unit-testable.
 */
export function useAiHarnessChat({
  provider,
  model,
  apiKey,
  augment,
  allowWebResearch,
  ollamaCpuOnly,
  ollamaBaseUrl,
  entities,
  claims,
  requiresKey,
}: UseAiHarnessChatOptions) {
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

      const apiMessages = buildMessages(
        messages.filter((m) => m.role !== 'system'),
        input,
        entities,
        claims,
        augment,
        researchResults,
      )

      let streamedContent = ''
      setMessages((m) => [...m, { role: 'assistant', content: '' }])

      await sendChatStream(
        {
          provider,
          model,
          apiKey,
          messages: apiMessages,
          signal: controller.signal,
          ollamaCpuOnly,
          ollamaBaseUrl,
        },
        (chunk) => {
          streamedContent += chunk
          setMessages((m) => {
            const updated = [...m]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: streamedContent,
            }
            return updated
          })
        },
      )
    } catch (err) {
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
    entities,
    claims,
    messages,
  ])

  return { messages, setMessages, input, setInput, isLoading, cooldownMs, handleSend }
}
