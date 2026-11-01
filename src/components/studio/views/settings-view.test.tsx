import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelCacheUsage } from '@/lib/studio/storage-report'

const mocks = vi.hoisted(() => ({
  readModelCacheUsage: vi.fn(),
  clearModelCache: vi.fn(),
  resetSemanticCache: vi.fn(),
  getSemanticIndexProgress: vi.fn(),
  getMemoryBytes: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}))

vi.mock('@/lib/studio/storage-report', async () => {
  const actual = await vi.importActual<typeof import('@/lib/studio/storage-report')>(
    '@/lib/studio/storage-report',
  )
  return {
    ...actual,
    readModelCacheUsage: mocks.readModelCacheUsage,
    clearModelCache: mocks.clearModelCache,
  }
})

vi.mock('@/lib/search/vector-store', () => ({
  defaultVectorStore: { size: 42, getMemoryBytes: mocks.getMemoryBytes },
  getSemanticIndexProgress: mocks.getSemanticIndexProgress,
  resetSemanticCache: mocks.resetSemanticCache,
  SEMANTIC_INDEX_MAX_BYTES: 64 * 1024 * 1024,
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, info: mocks.toastInfo, error: vi.fn() },
}))

import { SettingsView } from './settings-view'

const MB = 1024 * 1024

const usage = (overrides: Partial<ModelCacheUsage> = {}): ModelCacheUsage => ({
  available: true,
  entries: 3,
  bytes: 25 * MB,
  budgetBytes: 120 * MB,
  ...overrides,
})

beforeEach(() => {
  mocks.readModelCacheUsage.mockResolvedValue(usage())
  mocks.clearModelCache.mockResolvedValue(true)
  mocks.getSemanticIndexProgress.mockReturnValue({ status: 'ready', completed: 42, total: 42 })
  mocks.getMemoryBytes.mockReturnValue(2 * MB)
  mocks.toastSuccess.mockClear()
  mocks.toastInfo.mockClear()
  mocks.resetSemanticCache.mockClear()
})

describe('SettingsView', () => {
  it('reports the semantic index size and status', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('42')).toBeDefined()
    })
    expect(screen.getByText('2 MB')).toBeDefined()
    expect(screen.getByText('64 MB')).toBeDefined()
    expect(screen.getByText('ready')).toBeDefined()
  })

  it('reports the model cache size, count and budget', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeDefined()
    })
    expect(screen.getByText('25 MB')).toBeDefined()
    expect(screen.getByText('120 MB')).toBeDefined()
  })

  it('drops the semantic index and confirms it', async () => {
    render(<SettingsView />)
    await waitFor(() => {
      expect(screen.getByText('42')).toBeDefined()
    })

    screen.getByRole('button', { name: /rebuild index/i }).click()

    expect(mocks.resetSemanticCache).toHaveBeenCalledOnce()
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Semantic index cleared')
    // Re-measured after the reset, so the view does not keep showing the old size.
    await waitFor(() => {
      expect(mocks.readModelCacheUsage.mock.calls.length).toBeGreaterThan(1)
    })
  })

  it('clears the model cache and distinguishes empty from cleared', async () => {
    mocks.clearModelCache.mockResolvedValueOnce(false)
    render(<SettingsView />)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeDefined()
    })

    screen.getByRole('button', { name: /clear model cache/i }).click()

    await waitFor(() => {
      expect(mocks.toastInfo).toHaveBeenCalledWith('No cached model files')
    })
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('says so when storage cannot be measured instead of showing a false zero', async () => {
    mocks.readModelCacheUsage.mockResolvedValue(
      usage({ available: false, entries: 0, bytes: 0 }),
    )
    render(<SettingsView />)

    await waitFor(() => {
      expect(
        screen.getByText('Storage is not available in this browser'),
      ).toBeDefined()
    })
  })
})
