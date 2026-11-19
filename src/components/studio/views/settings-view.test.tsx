import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatBytes, type ModelCacheUsage } from '@/lib/studio/storage-report'

const mocks = vi.hoisted(() => ({
  readModelCacheUsage: vi.fn(),
  clearModelCache: vi.fn(),
  readOriginStorage: vi.fn(),
  requestPersistence: vi.fn(),
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
    readOriginStorage: mocks.readOriginStorage,
    requestPersistence: mocks.requestPersistence,
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
  mocks.readOriginStorage.mockResolvedValue({
    supported: true,
    estimate: { usageBytes: 200 * MB, quotaBytes: 1000 * MB },
    persisted: false,
    persistenceRequestSupported: true,
  })
  mocks.requestPersistence.mockResolvedValue({ supported: true, granted: true })
  mocks.getSemanticIndexProgress.mockReturnValue({ status: 'ready', completed: 42, total: 42 })
  mocks.getMemoryBytes.mockReturnValue(2 * MB)
  mocks.toastSuccess.mockClear()
  mocks.toastInfo.mockClear()
  mocks.requestPersistence.mockClear()
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

    fireEvent.click(screen.getByRole('button', { name: /rebuild index/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /clear model cache/i }))

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

  it('reports estimated origin usage, quota and persistence status', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('Estimated usage')).toBeDefined()
    })
    expect(screen.getByText('200 MB')).toBeDefined()
    expect(screen.getByText(formatBytes(1000 * MB))).toBeDefined()
    expect(screen.getByText(/Not granted/)).toBeDefined()
    expect(screen.getByText(/everything this site stores here/)).toBeDefined()
    expect(screen.getByText(/not a backup/)).toBeDefined()
    expect(screen.getByRole('region', { name: 'Origin storage' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Semantic index' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Model cache' })).toBeDefined()
  })

  it('does not warn while usage stays under the threshold', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('Estimated usage')).toBeDefined()
    })
    expect(screen.queryByText(/back up anything you cannot recreate/)).toBeNull()
  })

  it('warns when the origin approaches its reported quota', async () => {
    mocks.readOriginStorage.mockResolvedValue({
      supported: true,
      estimate: { usageBytes: 900 * MB, quotaBytes: 1000 * MB },
      persisted: false,
      persistenceRequestSupported: true,
    })
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText(/90%/)).toBeDefined()
    })
  })

  it('requests persistence and reports a grant', async () => {
    render(<SettingsView />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /request persistent storage/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /request persistent storage/i }))

    await waitFor(() => {
      expect(mocks.requestPersistence).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith('Persistent storage granted')
    })
  })

  it('explains when the browser declines persistence', async () => {
    mocks.requestPersistence.mockResolvedValue({ supported: true, granted: false })
    render(<SettingsView />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /request persistent storage/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /request persistent storage/i }))

    await waitFor(() => {
      expect(mocks.toastInfo).toHaveBeenCalledWith(
        'The browser declined persistent storage. Your data may still be evicted.',
      )
    })
  })

  it('hides the request button once persistence is already granted', async () => {
    mocks.readOriginStorage.mockResolvedValue({
      supported: true,
      estimate: { usageBytes: 1, quotaBytes: 10 },
      persisted: true,
      persistenceRequestSupported: true,
    })
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText(/^Granted/)).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /request persistent storage/i })).toBeNull()
  })

  it('degrades gracefully when the Storage API is missing', async () => {
    mocks.readOriginStorage.mockResolvedValue({
      supported: false,
      estimate: null,
      persisted: null,
      persistenceRequestSupported: false,
    })
    render(<SettingsView />)

    await waitFor(() => {
      expect(
        screen.getByText('This browser does not expose origin storage diagnostics.'),
      ).toBeDefined()
    })
    expect(screen.getByText(/not a backup/)).toBeDefined()
    expect(screen.getByRole('link', { name: /back up your library/i })).toBeDefined()
  })

  it('shows a usable message when the estimate call fails', async () => {
    mocks.readOriginStorage.mockResolvedValue({
      supported: true,
      estimate: null,
      persisted: false,
      persistenceRequestSupported: true,
    })
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('Your browser did not return usable storage measurements.')).toBeDefined()
    })
  })

  it('keeps unknown origin estimates visibly unknown', async () => {
    mocks.readOriginStorage.mockResolvedValue({
      supported: true,
      estimate: { usageBytes: null, quotaBytes: null },
      persisted: null,
      persistenceRequestSupported: false,
    })
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getAllByText('Unavailable')).toHaveLength(2)
    })
    expect(screen.queryByText('0 B')).toBeNull()
    expect(screen.getByText('This browser cannot request persistent storage.')).toBeDefined()
  })
})

