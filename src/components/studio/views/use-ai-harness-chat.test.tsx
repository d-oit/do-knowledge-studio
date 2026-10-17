import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChatRequest, ChatResult } from '@/lib/ai'

const { mockSendChatStream, mockBuildMessagesAsync, mockCanRequest } = vi.hoisted(() => ({
  mockSendChatStream: vi.fn<(request: ChatRequest, onChunk: (chunk: string) => void) => Promise<ChatResult>>(),
  mockBuildMessagesAsync: vi.fn(),
  mockCanRequest: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({
  sendChatStream: mockSendChatStream,
  buildMessagesAsync: mockBuildMessagesAsync,
  useRateLimiter: () => ({ canRequest: mockCanRequest }),
}))

import { useAiHarnessChat, type UseAiHarnessChatOptions } from './use-ai-harness-chat'
import { AppError, ErrorCode } from '@/lib/errors'

/** Baseline hook options; individual tests override what they exercise. */
const baseOptions: UseAiHarnessChatOptions = {
  provider: 'local',
  model: 'onnx-community/Qwen2.5-0.5B-Instruct',
  apiKey: '',
  augment: false,
  allowWebResearch: false,
  ollamaCpuOnly: false,
  ollamaBaseUrl: 'http://localhost:11434',
  localDevice: 'wasm' as const,
  entities: [],
  claims: [],
  requiresKey: false,
}

const resultFor = (content: string): ChatResult => ({
  content,
  provider: 'local',
  model: baseOptions.model,
})

/** Sends one message through the hook and returns the settled hook result. */
const sendMessage = async (text: string) => {
  const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
  act(() => { hook.result.current.setInput(text) })
  await act(async () => { await hook.result.current.handleSend() })
  return hook
}

describe('useAiHarnessChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuildMessagesAsync.mockResolvedValue([{ role: 'user', content: 'hi' }])
    mockCanRequest.mockReturnValue({ allowed: true, count: 1, limit: 10 })
  })

  it('renders streamed deltas as they arrive', async () => {
    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('Hello')
      onChunk(' world')
      return resultFor('Hello world')
    })

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toBe('Hello world')
  })

  it('renders the returned reply when the provider streamed nothing', async () => {
    // The in-browser local adapter's non-streamed fallback returns the whole
    // reply on the result and never calls onChunk — the bubble must still fill.
    mockSendChatStream.mockResolvedValue(resultFor('A fallback answer'))

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toBe('A fallback answer')
  })

  it('does not overwrite streamed content with the returned result', async () => {
    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('streamed')
      // Deliberately different from the streamed text: an implementation that
      // unconditionally replaced the chunks with the result would fail here.
      return resultFor('returned result')
    })

    const hook = await sendMessage('hi')

    const assistantMessages = hook.result.current.messages.filter((m) => m.role === 'assistant')
    expect(assistantMessages.at(-1)?.content).toBe('streamed')
  })

  it('maps HTTP 401 / unauthorized errors to friendly copy and logs raw error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('OpenRouter error 401: {"error":{"message":"Invalid API key","code":401}}')
    mockSendChatStream.mockRejectedValue(err)

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toContain('[Error] Your API key was rejected — check it in settings.')
    expect(last?.content).not.toContain('{"error":')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('AI harness send failed'),
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'OpenRouter error 401: {"error":{"message":"Invalid API key","code":401}}',
        }),
      }),
    )
    consoleSpy.mockRestore()
  })

  it('maps HTTP 429 rate limit errors to friendly copy', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('Ollama error 429: Rate limit exceeded')
    mockSendChatStream.mockRejectedValue(err)

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toContain('[Error] The provider is rate-limiting requests — wait and retry.')
    consoleSpy.mockRestore()
  })

  it('maps a typed provider error by code, preferring it over message text', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // The message text looks like a 401, but the typed code says rate-limited:
    // the code must win, proving the UI no longer pattern-matches provider text.
    const err = new AppError(ErrorCode.AI_PROVIDER_RATE_LIMITED, 'OpenRouter error 401: decoy')
    mockSendChatStream.mockRejectedValue(err)

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.content).toContain('[Error] The provider is rate-limiting requests — wait and retry.')
    expect(last?.content).not.toContain('API key was rejected')
    consoleSpy.mockRestore()
  })

  it('maps network errors to friendly copy', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new TypeError('Failed to fetch')
    mockSendChatStream.mockRejectedValue(err)

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toContain('[Error] Cannot reach the provider — check your connection or provider settings.')
    consoleSpy.mockRestore()
  })

  it('maps the unreachable-provider code to the same network copy', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // The provider layer classifies a transport failure by code; the UI must
    // read that code rather than fall through to the generic copy.
    const err = new AppError(ErrorCode.AI_PROVIDER_UNREACHABLE, 'OpenRouter network error: Failed to fetch')
    mockSendChatStream.mockRejectedValue(err)

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.content).toContain('[Error] Cannot reach the provider — check your connection or provider settings.')
    expect(last?.content).not.toContain('unexpected')
    consoleSpy.mockRestore()
  })

  it('maps unexpected provider errors to friendly copy', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('provider exploded')
    mockSendChatStream.mockRejectedValue(err)

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toContain('[Error] The provider returned an unexpected error.')
    expect(last?.content).not.toContain('provider exploded')
    consoleSpy.mockRestore()
  })

  it('leaves no empty assistant bubble behind when the provider fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSendChatStream.mockRejectedValue(new Error('provider exploded'))

    const hook = await sendMessage('hi')

    const empty = hook.result.current.messages.filter(
      (m) => m.role === 'assistant' && m.content.trim() === '',
    )
    expect(empty).toEqual([])
    consoleSpy.mockRestore()
  })

  it('leaves no assistant bubble when the turn is aborted before any delta', async () => {
    mockSendChatStream.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const hook = await sendMessage('hi')

    const messages = hook.result.current.messages
    expect(messages.map((m) => m.role)).toEqual(['assistant', 'user'])
    expect(messages.at(-1)?.content).toBe('hi')
  })

  it('keeps the partial reply when the turn is aborted mid-stream', async () => {
    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('Partial answer')
      throw new DOMException('Aborted', 'AbortError')
    })

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toBe('Partial answer')
  })

  it('counts a successful turn that streamed content', async () => {
    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('Hello')
      return resultFor('Hello')
    })

    const hook = await sendMessage('hi')

    expect(hook.result.current.completedTurns).toBe(1)
  })

  it('counts a successful turn that only answered on the result', async () => {
    mockSendChatStream.mockResolvedValue(resultFor('A fallback answer'))

    const hook = await sendMessage('hi')

    expect(hook.result.current.completedTurns).toBe(1)
  })

  it('does not count a provider failure as a completed turn', async () => {
    mockSendChatStream.mockRejectedValue(new Error('provider exploded'))

    const hook = await sendMessage('hi')

    // The turn ended, but with an `[Error] …` bubble: nothing completed here.
    expect(hook.result.current.completedTurns).toBe(0)
  })

  it('counts a provider failure as a failed turn for the failure announcement', async () => {
    mockSendChatStream.mockRejectedValue(new Error('provider exploded'))

    const hook = await sendMessage('hi')

    // #926 review: the transcript is `aria-live="off"`, so a failed turn must be
    // reported through its own signal or it is never spoken at all.
    expect(hook.result.current.failedTurns).toBe(1)
    expect(hook.result.current.completedTurns).toBe(0)
  })

  it('counts a timed-out turn as failed', async () => {
    // The timeout branch reports through `failedTurns` too: it appends a bubble
    // and returns before the success signal.
    const abortSignalStatics = AbortSignal as unknown as Record<string, unknown>
    const anyBackup = abortSignalStatics.any
    const timeoutBackup = abortSignalStatics.timeout
    delete abortSignalStatics.any
    delete abortSignalStatics.timeout

    mockSendChatStream.mockImplementation((request) => {
      const { promise, reject } = Promise.withResolvers<ChatResult>()
      request.signal?.addEventListener('abort', () => {
        reject(request.signal?.reason ?? new DOMException('Aborted', 'AbortError'))
      })
      return promise
    })

    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    act(() => { hook.result.current.setInput('hi') })

    vi.useFakeTimers()
    try {
      let turn: Promise<void> | undefined
      await act(async () => {
        turn = hook.result.current.handleSend()
        await vi.advanceTimersByTimeAsync(120_000)
      })
      await act(async () => { await turn })
    } finally {
      vi.useRealTimers()
      abortSignalStatics.any = anyBackup
      abortSignalStatics.timeout = timeoutBackup
    }

    expect(hook.result.current.failedTurns).toBe(1)
    expect(hook.result.current.completedTurns).toBe(0)
  })

  it('does not count an aborted turn as failed', async () => {
    mockSendChatStream.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const hook = await sendMessage('hi')

    // A stopped turn is neither a completion nor a failure: announcing either
    // would be telling the user something untrue.
    expect(hook.result.current.failedTurns).toBe(0)
    expect(hook.result.current.completedTurns).toBe(0)
  })

  it('does not count a turn aborted before any delta as completed', async () => {
    mockSendChatStream.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const hook = await sendMessage('hi')

    expect(hook.result.current.completedTurns).toBe(0)
  })

  it('does not count a turn stopped mid-stream as completed', async () => {
    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('Partial answer')
      throw new DOMException('Aborted', 'AbortError')
    })

    const hook = await sendMessage('hi')

    expect(hook.result.current.completedTurns).toBe(0)
  })

  it('does not count a turn that produced no assistant content', async () => {
    mockSendChatStream.mockResolvedValue(resultFor(''))

    const hook = await sendMessage('hi')

    expect(hook.result.current.completedTurns).toBe(0)
  })

  it('counts each completed turn separately', async () => {
    mockSendChatStream.mockResolvedValue(resultFor('answer'))
    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))

    await act(async () => { await hook.result.current.handleSend('first') })
    await act(async () => { await hook.result.current.handleSend('second') })

    expect(hook.result.current.completedTurns).toBe(2)
  })

  it('aborts the in-flight stream when the view unmounts', async () => {
    let capturedSignal: AbortSignal | undefined
    // A never-settling stream stands in for a live provider: the turn is only
    // ever released by the unmount cleanup, not by the promise resolving.
    mockSendChatStream.mockImplementation((request) => {
      capturedSignal = request.signal
      return new Promise<ChatResult>(() => undefined)
    })

    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    act(() => { hook.result.current.setInput('hi') })
    // Started, never awaited: the turn outlives this control flow and is
    // released only by unmount.
    void act(() => { void hook.result.current.handleSend() })
    await waitFor(() => { expect(capturedSignal).toBeDefined() })

    expect(capturedSignal?.aborted).toBe(false)
    hook.unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('aborts on unmount only when a turn is in flight', () => {
    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    // No turn was ever started: unmounting must not throw and must not
    // fabricate an abort for work that never existed.
    expect(() => { hook.unmount() }).not.toThrow()
  })

  it('aborts stream when stop is called and re-enables composer', async () => {
    let capturedSignal: AbortSignal | undefined
    mockSendChatStream.mockImplementation((request) => {
      capturedSignal = request.signal
      return new Promise<ChatResult>((_resolve, reject) => {
        if (request.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        request.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    act(() => { hook.result.current.setInput('hi') })
    void act(() => { void hook.result.current.handleSend() })
    await waitFor(() => { expect(capturedSignal).toBeDefined() })

    expect(hook.result.current.isLoading).toBe(true)
    expect(capturedSignal?.aborted).toBe(false)

    act(() => { hook.result.current.stop() })

    await waitFor(() => { expect(hook.result.current.isLoading).toBe(false) })
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('times out a silent provider, with no AbortSignal.any/timeout to lean on', async () => {
    // The timeout must not depend on `AbortSignal.any` (or `timeout`): those are
    // 2022/2024-baseline APIs, and on an engine missing them the previous
    // `any([signal, timeout])` composition dropped the timeout entirely, so a
    // provider that accepts and then goes silent hung the turn forever
    // (GitNexus on PR #923). Delete both before the request and prove it still
    // times out.
    const abortSignalStatics = AbortSignal as unknown as Record<string, unknown>
    const anyBackup = abortSignalStatics.any
    const timeoutBackup = abortSignalStatics.timeout
    delete abortSignalStatics.any
    delete abortSignalStatics.timeout

    let capturedSignal: AbortSignal | undefined
    mockSendChatStream.mockImplementation((request) => {
      capturedSignal = request.signal
      const { promise, reject } = Promise.withResolvers<ChatResult>()
      request.signal?.addEventListener('abort', () => {
        reject(request.signal?.reason ?? new DOMException('Aborted', 'AbortError'))
      })
      return promise
    })

    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    act(() => { hook.result.current.setInput('hi') })

    vi.useFakeTimers()
    try {
      let turn: Promise<void> | undefined
      await act(async () => {
        turn = hook.result.current.handleSend()
        // Mirrors the hook's REQUEST_TIMEOUT_MS contract, which the user-facing
        // copy pins at two minutes.
        await vi.advanceTimersByTimeAsync(120_000)
      })
      await act(async () => { await turn })
    } finally {
      vi.useRealTimers()
      abortSignalStatics.any = anyBackup
      abortSignalStatics.timeout = timeoutBackup
    }

    expect(capturedSignal?.aborted).toBe(true)
    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toBe(
      '[Error] The provider took too long to respond (2 minute limit).\n\nCheck your provider settings and try again.',
    )
    expect(hook.result.current.isLoading).toBe(false)
  })

  it('does not report a user-cancelled turn as a timeout', async () => {
    mockSendChatStream.mockImplementation((request) => {
      const { promise, reject } = Promise.withResolvers<ChatResult>()
      request.signal?.addEventListener('abort', () => {
        reject(request.signal?.reason ?? new DOMException('Aborted', 'AbortError'))
      })
      return promise
    })

    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    act(() => { hook.result.current.setInput('hi') })
    let turn: Promise<void> | undefined
    await act(async () => { turn = hook.result.current.handleSend() })

    act(() => { hook.result.current.stop() })
    await act(async () => { await turn })

    // An aborted turn keeps whatever streamed and adds nothing: no bubble, and
    // specifically no timeout copy.
    expect(hook.result.current.messages.map((m) => m.content).join('\n')).not.toContain('timed out')
  })

  it('sends the override text even when the composer input is empty (#846)', async () => {
    mockSendChatStream.mockResolvedValue(resultFor('chip answer'))
    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    await act(async () => { await hook.result.current.handleSend('Summarize the main entities.') })
    const userMessages = hook.result.current.messages.filter((m) => m.role === 'user')
    expect(userMessages.at(-1)?.content).toBe('Summarize the main entities.')
    expect(mockSendChatStream).toHaveBeenCalled()
  })

  it('assigns unique ids to user and assistant messages', async () => {
    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('Chunk 1')
      onChunk(' Chunk 2')
      return resultFor('Chunk 1 Chunk 2')
    })

    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    act(() => { hook.result.current.setInput('hi') })

    await act(async () => {
      await hook.result.current.handleSend()
    })

    const messages = hook.result.current.messages
    const initialMsg = messages[0]
    const userMsg = messages[1]
    const assistantMsg = messages[2]

    expect(initialMsg.id).toBe('init-assistant')
    expect(userMsg.id).toBeDefined()
    expect(assistantMsg.id).toBeDefined()
    expect(userMsg.id).not.toBe(assistantMsg.id)
    expect(typeof userMsg.id).toBe('string')
    expect(typeof assistantMsg.id).toBe('string')
  })

  it('keeps the assistant id stable while the bubble is updated in place mid-stream (#928)', async () => {
    const { promise: firstDeltaSeen, resolve: markFirstDelta } = Promise.withResolvers<void>()
    const { promise: resumeStream, resolve: resume } = Promise.withResolvers<void>()

    mockSendChatStream.mockImplementation(async (_request, onChunk) => {
      onChunk('Chunk 1')
      markFirstDelta()
      await resumeStream
      onChunk(' Chunk 2')
      return resultFor('Chunk 1 Chunk 2')
    })

    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    act(() => { hook.result.current.setInput('hi') })
    let pending: Promise<void> = Promise.resolve()
    act(() => { pending = hook.result.current.handleSend() })

    // Held open mid-stream: the turn has emitted one delta but not finished.
    await act(async () => { await firstDeltaSeen })
    await waitFor(() => { expect(hook.result.current.messages).toHaveLength(3) })

    const midStreamAssistant = hook.result.current.messages.at(-1)
    expect(midStreamAssistant?.role).toBe('assistant')
    expect(midStreamAssistant?.content).toBe('Chunk 1')
    const midStreamId = midStreamAssistant?.id
    expect(midStreamId).toBeDefined()

    act(() => { resume() })
    await act(async () => { await pending })

    const finalAssistant = hook.result.current.messages.at(-1)
    expect(finalAssistant?.content).toBe('Chunk 1 Chunk 2')
    // Same message object identity chain: the second delta updated the bubble
    // in place rather than replacing it with a fresh id-less message.
    expect(finalAssistant?.id).toBe(midStreamId)
  })
})
