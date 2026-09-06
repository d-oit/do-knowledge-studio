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
})
