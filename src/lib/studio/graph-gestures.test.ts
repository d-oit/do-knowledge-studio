import { describe, it, expect } from 'vitest'
import {
  clamp,
  computeDragPanOffset,
  computeZoom,
  computeFocalZoom,
  getClientToViewBoxScale,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_PAN,
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

  describe('getClientToViewBoxScale', () => {
    it('calculates aspect-ratio scaled units accurately', () => {
      // 800x560 canvas on an 800x560 viewport has 1:1 scale at zoom 1
      expect(getClientToViewBoxScale(canvas, 1.0, { width: 800, height: 560 })).toBeCloseTo(1.0)

      // When rendered at half size (400x280), 1 screen px = 2 canvas units
      expect(getClientToViewBoxScale(canvas, 1.0, { width: 400, height: 280 })).toBeCloseTo(2.0)
    })
  })

  describe('computeDragPanOffset', () => {
    it('translates pan offset with scale factor', () => {
      const initial = { x: 100, y: 50 }
      const next = computeDragPanOffset(initial, 20, -10, 1.5)
      expect(next).toEqual({ x: 130, y: 35 })
    })

    it('clamps pan offset within MAX_PAN limits', () => {
      const initial = { x: 3950, y: -3980 }
      const next = computeDragPanOffset(initial, 100, -50, 1)
      expect(next).toEqual({ x: MAX_PAN, y: -MAX_PAN })
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
