import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useStudioStore } from './store'
import type { Entity } from './types'

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

/**
 * Regression: aborting a send mid-flight used to leave `chatLoading` stuck at
 * `true`. `abortChatSend` nulls the controller, so the aborted send's catch
 * took the `chatSendAbort !== controller` early return and never cleared the
 * flag — the chat view showed a permanent typing indicator and refused
 * further sends until the user cleared the chat or reset the store.
 */
describe('cancelling a send clears the loading indicator', () => {
  const entity = (id: string): Entity => ({
    id, name: id, type: 'note', description: '', content: '', tags: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', links: [],
  })

  it('importData clears chatLoading when it aborts an in-flight send', async () => {
    useStudioStore.setState({ chat: [], chatLoading: false, entities: [entity('a')], claims: [] })
    void useStudioStore.getState().sendMessage('hello')
    expect(useStudioStore.getState().chatLoading).toBe(true)

    useStudioStore.getState().importData([entity('b')], [])
    await act(async () => { await Promise.resolve() })

    expect(useStudioStore.getState().chatLoading).toBe(false)
  })

  it('importWithRollback clears chatLoading when it aborts an in-flight send', async () => {
    useStudioStore.setState({ chat: [], chatLoading: false, entities: [entity('a')], claims: [] })
    void useStudioStore.getState().sendMessage('hello again')
    expect(useStudioStore.getState().chatLoading).toBe(true)

    useStudioStore.getState().importWithRollback([entity('c')], [])
    await act(async () => { await Promise.resolve() })

    expect(useStudioStore.getState().chatLoading).toBe(false)
  })

  it('resetStore clears chatLoading when it aborts an in-flight send', async () => {
    useStudioStore.setState({ chat: [], chatLoading: false, entities: [entity('a')], claims: [] })
    void useStudioStore.getState().sendMessage('reset me')
    expect(useStudioStore.getState().chatLoading).toBe(true)

    useStudioStore.getState().resetStore()
    await act(async () => { await Promise.resolve() })

    expect(useStudioStore.getState().chatLoading).toBe(false)
  })
})
