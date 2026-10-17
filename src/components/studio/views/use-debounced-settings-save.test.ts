import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { saveAISettings, type AISettings } from '@/lib/studio/ai-settings'
import {
  useDebouncedSettingsSave,
  AI_SETTINGS_SAVE_DEBOUNCE_MS,
} from './use-debounced-settings-save'

vi.mock('@/lib/studio/ai-settings', () => ({
  saveAISettings: vi.fn(() => Promise.resolve()),
}))

/** Baseline settings; individual tests override the field they exercise. */
const settings = (overrides: Partial<AISettings> = {}): AISettings => ({
  provider: 'openrouter',
  model: 'openrouter/free',
  apiKey: '',
  augmentWithLocal: true,
  ollamaCpuOnly: true,
  allowWebResearch: false,
  ollamaBaseUrl: 'http://localhost:11434',
  localDevice: 'wasm',
  ...overrides,
})

const renderDebounced = (initial: AISettings, enabled = true) =>
  renderHook(
    ({ value }: { value: AISettings }) => useDebouncedSettingsSave(value, enabled, vi.fn()),
    { initialProps: { value: initial } },
  )

describe('useDebouncedSettingsSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces rapid keystrokes into one write of the latest value', async () => {
    const save = vi.mocked(saveAISettings)
    const { rerender } = renderDebounced(settings({ apiKey: 'k' }))

    rerender({ value: settings({ apiKey: 'ke' }) })
    rerender({ value: settings({ apiKey: 'key' }) })
    rerender({ value: settings({ apiKey: 'key-' }) })
    rerender({ value: settings({ apiKey: 'key-1' }) })

    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AI_SETTINGS_SAVE_DEBOUNCE_MS)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({ apiKey: 'key-1' })
  })

  it('flushes the pending latest value on unmount', async () => {
    const save = vi.mocked(saveAISettings)
    const { rerender, unmount } = renderDebounced(settings({ apiKey: 'old' }))

    rerender({ value: settings({ apiKey: 'typed-before-leaving' }) })
    expect(save).not.toHaveBeenCalled()

    act(() => {
      unmount()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({ apiKey: 'typed-before-leaving' })
  })

  it('flushes when the field loses focus', async () => {
    const save = vi.mocked(saveAISettings)
    const { rerender } = renderDebounced(settings())

    rerender({ value: settings({ apiKey: 'blurred' }) })
    expect(save).not.toHaveBeenCalled()

    act(() => {
      document.dispatchEvent(new Event('focusout'))
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({ apiKey: 'blurred' })
  })

  it('flushes when the tab is hidden', async () => {
    const save = vi.mocked(saveAISettings)
    const { rerender } = renderDebounced(settings())

    rerender({ value: settings({ apiKey: 'hidden-key' }) })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(save).toHaveBeenCalledTimes(1)
  })

  it('never persists before settings have loaded', async () => {
    const save = vi.mocked(saveAISettings)
    renderDebounced(settings(), false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AI_SETTINGS_SAVE_DEBOUNCE_MS * 3)
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('does not rewrite an unchanged value after a flush', async () => {
    const save = vi.mocked(saveAISettings)
    const { rerender } = renderDebounced(settings())

    rerender({ value: settings({ apiKey: 'blurred' }) })
    act(() => {
      document.dispatchEvent(new Event('focusout'))
    })
    expect(save).toHaveBeenCalledTimes(1)

    // The debounce timer must not fire a second, identical write.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AI_SETTINGS_SAVE_DEBOUNCE_MS * 2)
    })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does not write the state it was opened with', async () => {
    const save = vi.mocked(saveAISettings)
    renderDebounced(settings({ apiKey: 'loaded-from-storage' }))

    // Nothing changed, so neither the debounce timer nor a blur may write.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AI_SETTINGS_SAVE_DEBOUNCE_MS * 2)
    })
    act(() => {
      document.dispatchEvent(new Event('focusout'))
    })

    expect(save).not.toHaveBeenCalled()
  })

  it('keeps the newest signature when an earlier write resolves late', async () => {
    const save = vi.mocked(saveAISettings)
    const resolvers: Array<() => void> = []
    save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve)
        }),
    )

    const { rerender } = renderDebounced(settings({ apiKey: 'older' }))
    rerender({ value: settings({ apiKey: 'older ' }) })
    act(() => {
      document.dispatchEvent(new Event('focusout'))
    })
    rerender({ value: settings({ apiKey: 'newest' }) })
    act(() => {
      document.dispatchEvent(new Event('focusout'))
    })
    expect(save).toHaveBeenCalledTimes(2)

    // The first write lands after the second one. Its completion must not
    // overwrite the marker with its stale signature, or returning to that
    // value below would be treated as already persisted and silently dropped.
    await act(async () => {
      resolvers[1]()
      resolvers[0]()
    })

    rerender({ value: settings({ apiKey: 'older ' }) })
    act(() => {
      document.dispatchEvent(new Event('focusout'))
    })

    expect(save).toHaveBeenCalledTimes(3)
    expect(save.mock.calls[2][0]).toMatchObject({ apiKey: 'older ' })
  })
})
