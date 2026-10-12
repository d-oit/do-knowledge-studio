'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from '@/components/studio/ui/confirm-dialog'
import { translate as deleteT } from '@/lib/i18n/messages/entity-delete'

interface EntityDeleteDialogProps {
  /** Whether the dialog is visible. */
  open: boolean
  /** Name of the entity about to be deleted. */
  entityName: string
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Confirmation dialog for deleting an entity (#863).
 *
 * The destructive treatment, copy and cancel-first focus behaviour are shared;
 * callers own the `open` state and supply the entity name.
 */
export const EntityDeleteDialog = ({
  open,
  entityName,
  onCancel,
  onConfirm,
}: EntityDeleteDialogProps) => (
  <ConfirmDialog
    open={open}
    ariaLabel={deleteT('entityDelete.ariaLabel')}
    title={deleteT('entityDelete.title')}
    subtitle={deleteT('entityDelete.subtitle')}
    body={deleteT('entityDelete.body', entityName)}
    cancelLabel={deleteT('entityDelete.cancel')}
    confirmLabel={deleteT('entityDelete.confirm')}
    onCancel={onCancel}
    onConfirm={onConfirm}
    icon={AlertTriangle}
  />
)

interface UseEntityDeleteConfirmationOptions {
  /** Display name for a pending id; the entity may have vanished since. */
  resolveName: (id: string) => string | undefined
  /** Runs only after the user confirms — never on the initial request. */
  onConfirm: (id: string) => void
}

/**
 * Owns the "ask, then delete" state for a canvas that has no undo (#863).
 *
 * The canvas views (graph, mind map) call `requestDelete(id)` from a keyboard
 * shortcut or a toolbar button and render the returned `dialog`; nothing is
 * destroyed until the user confirms. Keeping the state here rather than in
 * each view also keeps both views inside the 500-LOC rule.
 */
export const useEntityDeleteConfirmation = ({
  resolveName,
  onConfirm,
}: UseEntityDeleteConfirmationOptions) => {
  const [pendingId, setPendingId] = useState<string | null>(null)

  /**
   * Opens the confirmation for an id; the delete waits for `confirm`. An id
   * that no longer resolves is ignored, so a stale selection cannot prompt for
   * an entity that has already gone.
   */
  const requestDelete = useCallback(
    (id: string) => {
      if (resolveName(id) === undefined) return
      setPendingId(id)
    },
    [resolveName],
  )

  /** Dismisses the confirmation without touching the store. */
  const cancel = useCallback(() => { setPendingId(null) }, [])

  /** Confirms the pending delete, then clears the state. */
  const confirm = useCallback(() => {
    if (pendingId !== null) onConfirm(pendingId)
    setPendingId(null)
  }, [onConfirm, pendingId])

  const dialog = (
    <EntityDeleteDialog
      open={pendingId !== null}
      entityName={pendingId !== null ? (resolveName(pendingId) ?? '') : ''}
      onCancel={cancel}
      onConfirm={confirm}
    />
  )

  return { requestDelete, dialog }
}
