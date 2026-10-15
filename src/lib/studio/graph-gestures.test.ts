import { describe, it, expect } from 'vitest'
import {
  clamp,
  computeDragPanOffset,
  computeZoom,
  computeFocalZoom,
  computePointerDistance,
  computePointerMidpoint,
  computePinchGesture,
  getClientToViewBoxScale,
  computeMaxPan,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_MAX_PAN,
  MIN_TOUCH_TARGET_SIZE_PX,
} from './graph-gestures'

describe('graph-gestures', () => {
  const canvas = { width: 800, height: 560 }

  describe('clamp', () => {
    it('constrains numbers to inclusive bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('constants', () => {
    it('defines accessible touch targets', () => {
      expect(MIN_TOUCH_TARGET_SIZE_PX).toBeGreaterThanOrEqual(44)
    })
  })

  describe('computeMaxPan', () => {
    it('returns at least DEFAULT_MAX_PAN', () => {
      expect(computeMaxPan(canvas, 1.0)).toBeGreaterThanOrEqual(DEFAULT_MAX_PAN)
    })

    it('scales with large canvas and high zoom to keep outer nodes reachable', () => {
      const largeCanvas = { width: 3000, height: 2000 }
      const maxPanAtZoom3 = computeMaxPan(largeCanvas, 3.0)
      expect(maxPanAtZoom3).toBe(27000)
    })
  })

  describe('getClientToViewBoxScale', () => {
    it('calculates aspect-ratio scaled units accurately', () => {
      expect(getClientToViewBoxScale(canvas, 1.0, { width: 800, height: 560 })).toBeCloseTo(1.0)
      expect(getClientToViewBoxScale(canvas, 1.0, { width: 400, height: 280 })).toBeCloseTo(2.0)
    })
  })

  describe('computeDragPanOffset', () => {
    it('scales drag delta by both client scale and zoom level for 1:1 screen tracking', () => {
      const initial = { x: 100, y: 50 }
      const nextZoom2 = computeDragPanOffset(initial, 20, -10, 1.0, 2.0, canvas)
      expect(nextZoom2).toEqual({ x: 140, y: 30 })

      const nextZoomHalf = computeDragPanOffset(initial, 20, -10, 1.0, 0.5, canvas)
      expect(nextZoomHalf).toEqual({ x: 110, y: 45 })
    })

    it('clamps pan offset within dynamic max pan limits', () => {
      const initial = { x: 3950, y: -3980 }
      const next = computeDragPanOffset(initial, 100, -50, 1.0, 1.0, canvas)
      expect(next.x).toBeLessThanOrEqual(computeMaxPan(canvas, 1.0))
    })
  })

  describe('computeZoom', () => {
    it('increases zoom on negative deltaY (scroll up / pinch out)', () => {
      const current = 1.0
      const next = computeZoom(current, -100)
      expect(next).toBeGreaterThan(current)
    })

    it('decreases zoom on positive deltaY (scroll down / pinch in)', () => {
      const current = 1.0
      const next = computeZoom(current, 100)
      expect(next).toBeLessThan(current)
    })

    it('strictly clamps zoom to MIN_ZOOM and MAX_ZOOM', () => {
      expect(computeZoom(MAX_ZOOM, -1000)).toBe(MAX_ZOOM)
      expect(computeZoom(MIN_ZOOM, 1000)).toBe(MIN_ZOOM)
    })
  })

  describe('dual-pointer geometry & pinch gesture', () => {
    it('computes distance between two pointers correctly', () => {
      const p1 = { x: 100, y: 100 }
      const p2 = { x: 130, y: 140 }
      // dx = 30, dy = 40 => hypot = 50
      expect(computePointerDistance(p1, p2)).toBeCloseTo(50)
    })

    it('computes midpoint between two pointers', () => {
      const p1 = { x: 100, y: 200 }
      const p2 = { x: 300, y: 400 }
      expect(computePointerMidpoint(p1, p2)).toEqual({ x: 200, y: 300 })
    })

    it('computes pinch zoom scaling and midpoint pan', () => {
      const initialDist = 100
      const currentDist = 150 // 1.5x zoom
      const initialMid = { x: 400, y: 280 }
      const currentMid = { x: 420, y: 290 } // 20px right, 10px down pan
      const initialZoom = 1.0
      const initialPan = { x: 0, y: 0 }
      const clientRect = { width: 800, height: 560 }

      const result = computePinchGesture(
        initialDist,
        currentDist,
        initialMid,
        currentMid,
        initialZoom,
        initialPan,
        canvas,
        clientRect,
      )

      expect(result.zoom).toBeCloseTo(1.5)
      // initialMid (400, 280) zoomed by 1.5x gives panOffset (-200, -140)
      // midpoint translated by (20, 10):
      // scale at zoom 1.5 = (800 / 1.5) / 800 = 1 / 1.5
      // panDeltaX = 20 * (1 / 1.5) * 1.5 = 20 => -200 + 20 = -180
      // panDeltaY = 10 * (1 / 1.5) * 1.5 = 10 => -140 + 10 = -130
      expect(result.panOffset.x).toBeCloseTo(-180)
      expect(result.panOffset.y).toBeCloseTo(-130)
    })
  })

  describe('computeFocalZoom', () => {
    it('preserves graph coordinate under cursor across responsive zoom', () => {
      const currentZoom = 1.0
      const newZoom = 2.0
      const currentPan = { x: 0, y: 0 }
      const clientRect = { width: 800, height: 560 }
      const focalClient = { x: 400, y: 280 }

      const result = computeFocalZoom(
        currentZoom,
        newZoom,
        currentPan,
        canvas,
        focalClient,
        clientRect,
      )
      expect(result.zoom).toBe(newZoom)
      expect(result.panOffset.x).toBeCloseTo(-400)
      expect(result.panOffset.y).toBeCloseTo(-280)
    })

    it('returns unchanged pan when newZoom equals currentZoom', () => {
      const pan = { x: 120, y: -80 }
      const result = computeFocalZoom(1.5, 1.5, pan, canvas, { x: 200, y: 200 }, { width: 800, height: 560 })
      expect(result.zoom).toBe(1.5)
      expect(result.panOffset).toEqual(pan)
    })
  })
})
