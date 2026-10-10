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
    expect(consoleSpy).toHaveBeenCalledWith('AI harness send failed:', err)
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

  it('maps network errors to friendly copy', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new TypeError('Failed to fetch')
    mockSendChatStream.mockRejectedValue(err)

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toContain('[Error] Cannot reach the provider — check your connection or Ollama URL.')
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

  it('sends the override text even when the composer input is empty (#846)', async () => {
    mockSendChatStream.mockResolvedValue(resultFor('chip answer'))
    const hook = renderHook(() => useAiHarnessChat({ ...baseOptions }))
    await act(async () => { await hook.result.current.handleSend('Summarize the main entities.') })
    const userMessages = hook.result.current.messages.filter((m) => m.role === 'user')
    expect(userMessages.at(-1)?.content).toBe('Summarize the main entities.')
    expect(mockSendChatStream).toHaveBeenCalled()
  })

})
