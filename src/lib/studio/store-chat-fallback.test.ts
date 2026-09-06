import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStudioStore } from './store'

vi.mock('@/lib/search/search-worker-client', () => ({
  searchAsync: vi.fn(),
}))

import { searchAsync } from '@/lib/search/search-worker-client'

const mockedSearchAsync = vi.mocked(searchAsync)

describe('sendMessage synchronous fallback', () => {
  beforeEach(() => {
    useStudioStore.getState().resetStore()
    useStudioStore.getState().clearChat()
    mockedSearchAsync.mockReset()
  })

  it('appends an assistant reply when the worker-backed search rejects', async () => {
    mockedSearchAsync.mockRejectedValue(new Error('search worker exploded'))

    await useStudioStore.getState().sendMessage('Hello there')

    const { chat, chatLoading } = useStudioStore.getState()
    expect(chatLoading).toBe(false)
    expect(chat).toHaveLength(2)
    expect(chat[0].role).toBe('user')
    expect(chat[1].role).toBe('assistant')
  })

  it('does not append a reply when the send is aborted via AbortError', async () => {
    mockedSearchAsync.mockRejectedValue(new DOMException('Search aborted', 'AbortError'))

    await useStudioStore.getState().sendMessage('Hello there')

    const { chat, chatLoading } = useStudioStore.getState()
    expect(chatLoading).toBe(false)
    // An aborted send must not render a stale assistant answer.
    expect(chat.filter((m) => m.role === 'assistant')).toHaveLength(0)
  })

  it('clearChat aborts an in-flight send so it does not append a reply', async () => {
    // A worker request that stays pending until the AbortController signal fires
    // mimics a genuinely in-flight retrieval (as opposed to an immediate reject).
    mockedSearchAsync.mockImplementation(
      (_entities, _claims, _query, _limit, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Search aborted', 'AbortError')))
        }),
    )

    const sendPromise = useStudioStore.getState().sendMessage('Hello there')
    // User message is added synchronously; the assistant reply is still pending.
    expect(useStudioStore.getState().chat).toHaveLength(1)

    useStudioStore.getState().clearChat()
    expect(useStudioStore.getState().chat).toHaveLength(0)

    await sendPromise
    // The cleared conversation must not receive a late assistant reply.
    expect(useStudioStore.getState().chat).toHaveLength(0)
    expect(useStudioStore.getState().chatLoading).toBe(false)
  })

  it('resetStore aborts an in-flight send so it does not append a reply', async () => {
    mockedSearchAsync.mockImplementation(
      (_entities, _claims, _query, _limit, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Search aborted', 'AbortError')))
        }),
    )

    const sendPromise = useStudioStore.getState().sendMessage('Hello there')
    expect(useStudioStore.getState().chat).toHaveLength(1)

    useStudioStore.getState().resetStore()
    // resetStore restores the seed welcome message and drops the pending user msg.
    expect(useStudioStore.getState().chat).toHaveLength(1)
    expect(useStudioStore.getState().chat[0].role).toBe('assistant')

    await sendPromise
    // A send started before a workspace reset must not append an answer into it.
    expect(useStudioStore.getState().chat).toHaveLength(1)
    expect(useStudioStore.getState().chat[0].content).toContain('Welcome to your local knowledge studio')
    expect(useStudioStore.getState().chatLoading).toBe(false)
  })
})
