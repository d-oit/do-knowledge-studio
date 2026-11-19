import { describe, expect, it, vi } from 'vitest'
import type { ImportPreview } from './export-types'
import { stagePickedNonJsonFiles } from './import-staging'
import { toast } from 'sonner'
import { MAX_IMPORT_BYTES } from '@/lib/studio/constants'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

/** Collects the preview staged by the helper under test. */
const stageOne = async (files: File[]): Promise<ImportPreview | null> => {
  let preview: ImportPreview | null = null
  const handled = await stagePickedNonJsonFiles(files, [], (next) => {
    preview = next
  })
  expect(handled).toBe(true)
  return preview
}

describe('stagePickedNonJsonFiles', () => {
  it('stages two same-named notes instead of dropping one', async () => {
    const preview = await stageOne([
      new File(['---\ntitle: Shared\n---\n\nbody one'], 'note.md'),
      new File(['---\ntitle: Shared\n---\n\nbody two'], 'note.md'),
    ])
    expect(preview?.entities).toHaveLength(2)
    expect(preview?.conflicts).toEqual(['Shared'])
  })

  it('returns false for a JSON pick so the caller falls through', async () => {
    let preview: ImportPreview | null = { entities: [], claims: [], entityCount: 0, claimCount: 0, version: 1, duplicateIds: [] }
    const handled = await stagePickedNonJsonFiles(
      [new File(['{}'], 'backup.json')],
      [],
      (next) => {
        preview = next
      },
    )
    expect(handled).toBe(false)
    expect(preview?.entities).toHaveLength(0)
  })

  it('rejects a Markdown batch over the aggregate import limit before reading files', async () => {
    const files = [
      new File(['---\ntitle: First\n---\n\nbody'], 'first.md'),
      new File(['---\ntitle: Second\n---\n\nbody'], 'second.md'),
    ]
    const perFileBytes = Math.floor(MAX_IMPORT_BYTES / 2) + 1
    for (const file of files) {
      Object.defineProperty(file, 'size', { value: perFileBytes })
    }
    const textReads = files.map((file) => vi.spyOn(file, 'text'))
    const setImportPreview = vi.fn()

    await stagePickedNonJsonFiles(files, [], setImportPreview)

    expect(toast.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: expect.stringContaining('limit') }),
    )
    expect(textReads.every((read) => read.mock.calls.length === 0)).toBe(true)
    expect(setImportPreview).not.toHaveBeenCalled()
  })
})
