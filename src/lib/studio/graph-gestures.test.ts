import { describe, it, expect } from 'vitest'
import {
  clamp,
  computeDragPanOffset,
  computeZoom,
  computeFocalZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_PAN,
} from './graph-gestures'

describe('graph-gestures', () => {
  describe('clamp', () => {
    it('constrains numbers to inclusive bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('computeDragPanOffset', () => {
    it('translates pan offset by delta', () => {
      const initial = { x: 100, y: 50 }
      const next = computeDragPanOffset(initial, 25, -15)
      expect(next).toEqual({ x: 125, y: 35 })
    })

    it('clamps pan offset within MAX_PAN limits', () => {
      const initial = { x: 3950, y: -3980 }
      const next = computeDragPanOffset(initial, 100, -50)
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
    it('keeps the focal point fixed in graph space across zoom change', () => {
      const currentZoom = 1.0
      const newZoom = 2.0
      const currentPan = { x: 0, y: 0 }
      const focalPoint = { x: 400, y: 300 }

      const result = computeFocalZoom(currentZoom, newZoom, currentPan, focalPoint)
      expect(result.zoom).toBe(newZoom)

      // Initial graph coordinate at focalPoint: (400 - 0) / 1.0 = 400
      // Next graph coordinate at focalPoint: (400 - panOffset.x) / 2.0 must equal 400
      // => 400 - panOffset.x = 800 => panOffset.x = -400
      expect(result.panOffset.x).toBe(-400)
      expect(result.panOffset.y).toBe(-300)

      const graphXInitial = (focalPoint.x - currentPan.x) / currentZoom
      const graphXNext = (focalPoint.x - result.panOffset.x) / result.zoom
      expect(graphXNext).toBeCloseTo(graphXInitial)

      const graphYInitial = (focalPoint.y - currentPan.y) / currentZoom
      const graphYNext = (focalPoint.y - result.panOffset.y) / result.zoom
      expect(graphYNext).toBeCloseTo(graphYInitial)
    })

    it('returns unchanged pan when newZoom equals currentZoom', () => {
      const pan = { x: 120, y: -80 }
      const result = computeFocalZoom(1.5, 1.5, pan, { x: 200, y: 200 })
      expect(result.zoom).toBe(1.5)
      expect(result.panOffset).toEqual(pan)
    })
  })
})
