'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useCursors, type RemoteCursor } from '@/lib/sync/use-cursors'

interface RemoteCursorsProps {
  className?: string
  view?: string
}

export function RemoteCursors({ className, view }: RemoteCursorsProps) {
  const { cursorsInView } = useCursors(view)

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-50', className)}>
      {cursorsInView.map((cursor) => (
        <CursorOverlay key={cursor.deviceId} cursor={cursor} />
      ))}
    </div>
  )
}

function CursorOverlay({ cursor }: { cursor: RemoteCursor }) {
  if (!cursor.position) return null

  return (
    <div
      className="absolute transition-all duration-100 ease-out"
      style={{
        left: cursor.position.x,
        top: cursor.position.y,
        transform: 'translate(-1px, -1px)',
      }}
    >
      {/* Cursor arrow */}
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        className="drop-shadow-sm"
      >
        <path
          d="M0 0L16 12L8 12L5 20L0 0Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      {/* Name label */}
      <div
        className="absolute left-4 top-4 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </div>
    </div>
  )
}

interface CursorTrackerProps {
  view: string
  children: React.ReactNode
}

export function CursorTracker({ view, children }: CursorTrackerProps) {
  const { setCursor, clearCursor, select, clearSelect } = useCursors(view)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      setCursor(e.clientX - rect.left, e.clientY - rect.top)
    }

    const handleMouseLeave = () => {
      clearCursor()
    }

    const handleSelect = () => {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
        const range = selection.getRangeAt(0)
        select(
          range.startOffset,
          range.endOffset,
          selection.toString(),
        )
      } else {
        clearSelect()
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('selectionchange', handleSelect)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('selectionchange', handleSelect)
      clearCursor()
      clearSelect()
    }
  }, [view, setCursor, clearCursor, select, clearSelect])

  return (
    <div ref={containerRef} className="relative">
      {children}
      <RemoteCursors view={view} />
    </div>
  )
}
