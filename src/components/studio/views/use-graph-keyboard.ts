'use client'

import { useCallback } from 'react'
import type { Dispatch, KeyboardEvent, SetStateAction } from 'react'
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/studio/graph-gestures'
import { useStudioStore } from '@/lib/studio/store'
import { useAnnouncer } from '@/lib/a11y/announcer'
import { translate as announceT } from '@/lib/i18n/messages/announce'
import type { Entity } from '@/lib/studio/types'

/** Arrow-key pan step in SVG units. */
const KEYBOARD_PAN_STEP = 30
/** Keyboard zoom increment per `+`/`-` press. */
const KEYBOARD_ZOOM_STEP = 0.15
/** Zoom level the Home key restores. */
const HOME_ZOOM = 1

interface GraphKeyboardParams {
  /** True while the comparison dialog is open; the canvas must not react then. */
  isCompareOpen: boolean
  selectedEntityId: string | null
  entities: Entity[]
  setPanOffset: Dispatch<SetStateAction<{ x: number; y: number }>>
  setZoom: Dispatch<SetStateAction<number>>
}

/**
 * Canvas keyboard shortcuts: arrow-key pan, `+`/`-` zoom, Home reset, and
 * Delete/Backspace removal of the selected entity.
 *
 * The comparison dialog renders inside the keydown-owning canvas subtree, so
 * React bubbling would let dialog keystrokes reach this handler; while it is
 * open (`isCompareOpen`), every canvas shortcut stands down.
 */
export const useGraphKeyboard = ({
  isCompareOpen,
  selectedEntityId,
  entities,
  setPanOffset,
  setZoom,
}: GraphKeyboardParams) => {
  const announce = useAnnouncer()

  return useCallback(
    (e: KeyboardEvent) => {
      if (isCompareOpen) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x + KEYBOARD_PAN_STEP, y: p.y }))
          break
        case 'ArrowRight':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x - KEYBOARD_PAN_STEP, y: p.y }))
          break
        case 'ArrowUp':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x, y: p.y + KEYBOARD_PAN_STEP }))
          break
        case 'ArrowDown':
          e.preventDefault()
          setPanOffset((p) => ({ x: p.x, y: p.y - KEYBOARD_PAN_STEP }))
          break
        case '+':
        case '=':
          e.preventDefault()
          setZoom((z) => Math.min(z + KEYBOARD_ZOOM_STEP, MAX_ZOOM))
          break
        case '-':
          e.preventDefault()
          setZoom((z) => Math.max(z - KEYBOARD_ZOOM_STEP, MIN_ZOOM))
          break
        case 'Home':
          e.preventDefault()
          setPanOffset({ x: 0, y: 0 })
          setZoom(HOME_ZOOM)
          break
        case 'Delete':
        case 'Backspace':
          if (selectedEntityId) {
            e.preventDefault()
            // Deleting from the canvas removes the node with no other visual
            // trace, so the live region names what was destroyed.
            const removed = entities.find((entity) => entity.id === selectedEntityId)
            if (removed) announce(announceT('announce.entityDeleted', removed.name))
            useStudioStore.getState().deleteEntity(selectedEntityId)
          }
          break
        default:
          break
      }
    },
    [announce, entities, isCompareOpen, selectedEntityId, setPanOffset, setZoom],
  )
}
