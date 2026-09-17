import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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

  it('surfaces a provider failure as an error message', async () => {
    mockSendChatStream.mockRejectedValue(new Error('provider exploded'))

    const hook = await sendMessage('hi')

    const last = hook.result.current.messages.at(-1)
    expect(last?.role).toBe('assistant')
    expect(last?.content).toContain('[Error] provider exploded')
  })
})
