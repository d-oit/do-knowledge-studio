import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeClaim, makeEntity, resetStore } from '@/lib/studio/test-helpers'
import { useStudioStore } from '@/lib/studio/store'
import { buildSyncBundle } from '@/lib/sync/file-bundle'
import { SyncFilePanel } from './sync-file-panel'

const mocks = vi.hoisted(() => ({
  downloadFile: vi.fn(),
}))

vi.mock('./download', () => ({
  downloadFile: mocks.downloadFile,
}))

const renderPanel = (activeRoomId = 'room-alpha') => {
  const onConflicts = vi.fn()
  const onEvent = vi.fn()
  render(
    <SyncFilePanel
      activeRoomId={activeRoomId}
      onConflicts={onConflicts}
      onEvent={onEvent}
    />,
  )
  return { onConflicts, onEvent }
}

describe('SyncFilePanel', () => {
  it('exports the current corpus as a bundle file', async () => {
    resetStore()
    mocks.downloadFile.mockClear()
    const { onEvent } = renderPanel()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export bundle/i }))
    })

    await waitFor(() => {
      expect(mocks.downloadFile).toHaveBeenCalledTimes(1)
    })
    const [name, text, mime] = mocks.downloadFile.mock.calls[0] as [string, string, string]
    expect(name).toMatch(/^dks-sync-room-alpha-\d{4}-\d{2}-\d{2}\.dksb$/)
    expect(mime).toBe('application/json')
    const parsed = JSON.parse(text) as { format: string; roomId: string; encrypted: boolean }
    expect(parsed.format).toBe('dks-sync-bundle')
    expect(parsed.roomId).toBe('room-alpha')
    expect(parsed.encrypted).toBe(false)
    expect(onEvent).toHaveBeenCalledWith('sync', expect.stringContaining('Exported'))
  })

  it('merges an imported bundle into the store', async () => {
    resetStore()
    const incoming = makeEntity({ id: 'e-imported', name: 'Imported note' })
    const incomingClaim = makeClaim({ id: 'c-imported', entityId: 'e-imported' })
    const text = await buildSyncBundle({
      roomId: 'room-alpha',
      entities: [incoming],
      claims: [incomingClaim],
    })
    const { onConflicts, onEvent } = renderPanel()

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([text], 'bundle.dksb', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(useStudioStore.getState().entities.some((e) => e.id === 'e-imported')).toBe(true)
    })
    expect(useStudioStore.getState().claims.some((c) => c.id === 'c-imported')).toBe(true)
    expect(onConflicts).toHaveBeenCalledWith([])
    expect(onEvent).toHaveBeenCalledWith('sync', expect.stringContaining('Merged'))
  })

  it('reports a wrong passphrase without touching the store', async () => {
    resetStore()
    const before = useStudioStore.getState().entities.length
    const text = await buildSyncBundle({
      roomId: 'room-alpha',
      entities: [makeEntity({ id: 'e-secret' })],
      claims: [],
      password: 'correct horse',
    })
    const { onEvent } = renderPanel()

    const passwordInput = screen.getByLabelText(/passphrase/i)
    fireEvent.change(passwordInput, { target: { value: 'wrong horse' } })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([text], 'bundle.dksb', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(onEvent).toHaveBeenCalledWith('error', expect.stringContaining('decrypt'))
    })
    expect(useStudioStore.getState().entities).toHaveLength(before)
  })
})
