import { describe, expect, it, vi } from 'vitest'
import type { ImportPreview } from './export-types'
import { stagePickedNonJsonFiles } from './import-staging'

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
})
