'use client'

import { useCallback, useRef } from 'react'
import {
  DRAG_PAN_SLOP_PX,
  getClientToViewBoxScale,
  computeDragPanOffset,
  computeZoom,
  computeFocalZoom,
  computePointerDistance,
  computePointerMidpoint,
  computePinchGesture,
} from '@/lib/studio/graph-gestures'
import type { CanvasSize } from '@/lib/studio/graph-viewport'

interface GraphCanvasGestureOptions {
  canvas: CanvasSize
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  panOffset: { x: number; y: number }
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
}

/** Owns pointer-pan, pinch, and focal-wheel interactions for the graph canvas. */
export const useGraphCanvasGestures = ({
  canvas,
  zoom,
  setZoom,
  panOffset,
  setPanOffset,
}: GraphCanvasGestureOptions) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStateRef = useRef<{
    initialDistance: number
    initialMidpoint: { x: number; y: number }
    initialZoom: number
    initialPan: { x: number; y: number }
  } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'touch' && e.button !== 0) return
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activePointersRef.current.size === 1) {
      pointerOriginRef.current = { x: e.clientX, y: e.clientY }
      isDraggingRef.current = false
      pinchStateRef.current = null
    } else if (activePointersRef.current.size === 2) {
      const [p1, p2] = Array.from(activePointersRef.current.values())
      pinchStateRef.current = {
        initialDistance: computePointerDistance(p1, p2),
        initialMidpoint: computePointerMidpoint(p1, p2),
        initialZoom: zoom,
        initialPan: { ...panOffset },
      }
      isDraggingRef.current = true
    }
  }, [zoom, panOffset])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    if (activePointersRef.current.size === 2 && pinchStateRef.current) {
      const [p1, p2] = Array.from(activePointersRef.current.values())
      const currentDist = computePointerDistance(p1, p2)
      const currentMid = computePointerMidpoint(p1, p2)
      const initialMidpoint = pinchStateRef.current.initialMidpoint
      const focalRelative = { x: initialMidpoint.x - rect.left, y: initialMidpoint.y - rect.top }
      const result = computePinchGesture(
        pinchStateRef.current.initialDistance,
        currentDist,
        focalRelative,
        { x: currentMid.x - rect.left, y: currentMid.y - rect.top },
        pinchStateRef.current.initialZoom,
        pinchStateRef.current.initialPan,
        canvas,
        { width: rect.width, height: rect.height },
      )
      setZoom(result.zoom)
      setPanOffset(result.panOffset)
      return
    }
    if (activePointersRef.current.size !== 1 || !pointerOriginRef.current) return
    const dx = e.clientX - pointerOriginRef.current.x
    const dy = e.clientY - pointerOriginRef.current.y
    if (!isDraggingRef.current) {
      if (Math.hypot(dx, dy) < DRAG_PAN_SLOP_PX) return
      isDraggingRef.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const clientScale = getClientToViewBoxScale(canvas, zoom, { width: rect.width, height: rect.height })
    pointerOriginRef.current = { x: e.clientX, y: e.clientY }
    setPanOffset((previous) => computeDragPanOffset(previous, dx, dy, clientScale, zoom, canvas))
  }, [canvas, zoom, setZoom, setPanOffset])

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    activePointersRef.current.delete(e.pointerId)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (activePointersRef.current.size === 1) {
      const remaining = Array.from(activePointersRef.current.values())[0]
      pointerOriginRef.current = { ...remaining }
      pinchStateRef.current = null
    } else if (activePointersRef.current.size === 0) {
      pointerOriginRef.current = null
      pinchStateRef.current = null
      setTimeout(() => { isDraggingRef.current = false }, 0)
    }
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const focalPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const clientRect = { width: rect.width, height: rect.height }
    setZoom((currentZoom) => {
      const nextZoom = computeZoom(currentZoom, e.deltaY)
      setPanOffset((currentPan) => computeFocalZoom(currentZoom, nextZoom, currentPan, canvas, focalPoint, clientRect).panOffset)
      return nextZoom
    })
  }, [canvas, setZoom, setPanOffset])

  return { svgRef, isDraggingRef, handlePointerDown, handlePointerMove, handlePointerUp, handleWheel }
}
