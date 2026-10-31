import type { ComponentProps } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BackupPanel } from './backup-panel'
import { buildBackupArchive } from '@/lib/backup/archive'
import type { Claim, Entity } from '@/lib/studio/types'

const downloadBlob = vi.hoisted(() => vi.fn())
vi.mock('./export-types', () => ({
  downloadBlob,
  todayStamp: () => '2026-10-31',
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const entity: Entity = {
  id: 'backup-entity',
  name: 'Backup Entity',
  type: 'note',
  description: '',
  content: 'Backup content',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

type ImportWithRollback = ComponentProps<typeof BackupPanel>['importWithRollback']

const successfulImport: ImportWithRollback = () => ({
  success: true,
  backupPersisted: true,
})

const renderPanel = (importWithRollback: ImportWithRollback = vi.fn(successfulImport)) =>
  render(
    <BackupPanel
      entities={[entity]}
      claims={[]}
      importWithRollback={importWithRollback}
    />,
  )

describe('BackupPanel', () => {
  beforeEach(() => {
    downloadBlob.mockClear()
  })

  it('builds and downloads a verified archive', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Download backup/i }))

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1)
    })
    const [filename, blob] = downloadBlob.mock.calls[0] as [string, Blob]
    expect(filename).toBe('do-knowledge-studio-backup-2026-10-31.dksb')
    const raw = await blob.text()
    expect(JSON.parse(raw)).toMatchObject({ format: 'do-knowledge-studio-backup' })
  })

  it('previews a valid archive and applies a replace through the store action', async () => {
    const importWithRollback = vi.fn((_entities: Entity[], _claims: Claim[]) => ({
      success: true as const,
      backupPersisted: true,
    }))
    renderPanel(importWithRollback)
    const raw = await buildBackupArchive({
      entities: [entity],
      claims: [],
      appVersion: '0.1.0',
    })
    const file = new File([raw], 'backup.dksb', { type: 'application/json' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Restore preview/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Replace library/i }))

    await waitFor(() => {
      expect(importWithRollback).toHaveBeenCalledTimes(1)
    })
    expect(importWithRollback.mock.calls[0][0]).toEqual([entity])
  })

  it('reports a corrupt archive without calling the store', async () => {
    const importWithRollback = vi.fn()
    renderPanel(importWithRollback)
    const file = new File(['{"format":"broken"}'], 'backup.dksb', { type: 'application/json' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(importWithRollback).not.toHaveBeenCalled()
  })
})
