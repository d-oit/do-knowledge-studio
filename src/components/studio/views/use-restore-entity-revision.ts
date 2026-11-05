'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useStudioStore } from '@/lib/studio/store'
import type { AnyEntityType, Entity } from '@/lib/studio/types'
import { translate } from '@/lib/i18n/messages/revisions'

/** Form setters the editor re-seeds after a restore. */
interface RestoreSetters {
  setName: (value: string) => void
  setType: (value: AnyEntityType) => void
  setContent: (value: string) => void
  setDescription: (value: string) => void
  setSourceUrl: (value: string) => void
  setTags: (value: string[]) => void
}

/**
 * Restores a stored revision of the note being edited (#1060).
 *
 * Two writes matter and both are deliberate: the store write makes the restore
 * itself undoable and turns the pre-restore text into a new revision, and the
 * form re-seed keeps the textarea and save path in sync with it. Only the form
 * being re-seeded would resurrect the old text on the next save; only the store
 * write would leave the editor showing text that no longer exists.
 */
export const useRestoreEntityRevision = ({
  editing,
  setName,
  setType,
  setContent,
  setDescription,
  setSourceUrl,
  setTags,
}: { editing: Entity | null } & RestoreSetters): ((snapshot: Entity) => void) => {
  const restoreEntityRevision = useStudioStore((state) => state.restoreEntityRevision)
  return useCallback(
    (snapshot: Entity) => {
      if (!editing) return
      restoreEntityRevision({ ...snapshot, id: editing.id })
      setName(snapshot.name)
      setType(snapshot.type)
      setContent(snapshot.content)
      setDescription(snapshot.description)
      setSourceUrl(snapshot.sourceUrl ?? '')
      setTags(snapshot.tags)
      toast.success(translate('revisions.restored'))
    },
    [
      editing,
      restoreEntityRevision,
      setName,
      setType,
      setContent,
      setDescription,
      setSourceUrl,
      setTags,
    ],
  )
}
