/**
 * Graph PNG export tests (Plan 20: "1080p PNG from graph controls").
 *
 * `computePngLayout` is pure, so the letterboxing maths is pinned directly for
 * wide, tall, and square sources; the renderer tests then prove the fixed canvas,
 * the centring offsets, and the painted background actually reach the raster.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EXPORT_COLORS } from '@/lib/export/export-theme'
import {
  PNG_OUTPUT_HEIGHT,
  PNG_OUTPUT_WIDTH,
  computePngLayout,
  exportGraphPng,
} from './export-graph-png'
import { downloadBlob } from './export-types'

vi.mock('./export-types', () => ({
  downloadBlob: vi.fn(),
  todayStamp: () => '2026-10-17',
}))

/** Tolerance for fractional offsets (half-pixel margins are legitimate). */
const EPSILON = 0.001

/** What `getComputedStyle` reports for a surface that paints nothing. */
const NO_BACKGROUND = 'rgba(0, 0, 0, 0)'

/** Themed canvas colour used to prove the renderer follows the surface. */
const THEMED_BACKGROUND = 'rgb(20, 17, 13)'

/** Records what the renderer painted. */
interface RecordedPaint {
  fillStyle: string
  fillRect: number[]
  drawImage: number[]
}

let paint: RecordedPaint = { fillStyle: '', fillRect: [], drawImage: [] }

/** Canvas the renderer created, captured through its context lookup. */
let renderedCanvas: HTMLCanvasElement | null = null

let serializedSvgBlob: Blob | null = null

/** The serialized source image, or a loud failure if the renderer made none. */
const createdSvgBlob = (): Blob => {
  if (!serializedSvgBlob) throw new Error('renderer serialized no SVG')
  return serializedSvgBlob
}

/**
 * Image stand-in.
 *
 * jsdom cannot load a blob-backed SVG, so the test drives `onload` itself and
 * sets the natural size the renderer measures before drawing.
 */
class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = PNG_OUTPUT_WIDTH
  naturalHeight = PNG_OUTPUT_HEIGHT
  requestedSrc = ''
  set src(value: string) {
    this.requestedSrc = value
  }
}

/** Latest image the renderer created. */
let imageStub: MockImage | undefined

/** The image the last render created, or a loud failure. */
const createdImage = (): MockImage => {
  if (!imageStub) throw new Error('renderer created no image')
  return imageStub
}

/** The canvas the last render created, or a loud failure. */
const createdCanvas = (): HTMLCanvasElement => {
  if (!renderedCanvas) throw new Error('renderer created no canvas')
  return renderedCanvas
}

/**
 * Records the canvas the mocked `getContext` ran on.
 *
 * The instance arrives as `this`, and assigning `this` to a variable directly is
 * a lint error (`no-this-alias`), so the write goes through a parameter.
 */
const rememberCanvas = (canvas: HTMLCanvasElement): void => {
  renderedCanvas = canvas
}

/** Records the image the stubbed constructor created (same `this` rule). */
const rememberImage = (image: MockImage): void => {
  imageStub = image
}

/** Installs the DOM pieces jsdom does not ship (canvas raster, image load, blob URLs). */
const stubRasterPipeline = (): void => {
  paint = { fillStyle: '', fillRect: [], drawImage: [] }
  renderedCanvas = null
  imageStub = undefined
  serializedSvgBlob = null
  const context = {
    set fillStyle(value: string) {
      paint.fillStyle = value
    },
    get fillStyle() {
      return paint.fillStyle
    },
    fillRect: (x: number, y: number, width: number, height: number) => {
      paint.fillRect = [x, y, width, height]
    },
    drawImage: (_image: unknown, ...args: number[]) => {
      paint.drawImage = args
    },
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    rememberCanvas(this)
    return context as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(['png'], { type: 'image/png' }))
  })
  vi.stubGlobal(
    'Image',
    class extends MockImage {
      constructor() {
        super()
        rememberImage(this)
      }
    },
  )
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      serializedSvgBlob = blob
      return 'blob:graph'
    }),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
}

/** Creates an SVG graph attached to a surface, as the graph view mounts it. */
const mountGraph = (): SVGSVGElement => {
  const surface = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  surface.appendChild(svg)
  document.body.appendChild(surface)
  return svg
}

/**
 * Asserts the fit contract for a source of the given size: fixed output,
 * centred, no overflow, and no more magnification than the box allows.
 */
const expectFitsCanvas = (sourceWidth: number, sourceHeight: number): void => {
  const layout = computePngLayout(sourceWidth, sourceHeight)
  const scaledWidth = sourceWidth * layout.scale
  const scaledHeight = sourceHeight * layout.scale

  expect(layout.width).toBe(PNG_OUTPUT_WIDTH)
  expect(layout.height).toBe(PNG_OUTPUT_HEIGHT)
  expect(layout.offsetX).toBeGreaterThanOrEqual(0)
  expect(layout.offsetY).toBeGreaterThanOrEqual(0)
  expect(layout.offsetX + scaledWidth).toBeLessThanOrEqual(PNG_OUTPUT_WIDTH + EPSILON)
  expect(layout.offsetY + scaledHeight).toBeLessThanOrEqual(PNG_OUTPUT_HEIGHT + EPSILON)
  expect(layout.scale).toBeLessThanOrEqual(
    Math.min(PNG_OUTPUT_WIDTH / sourceWidth, PNG_OUTPUT_HEIGHT / sourceHeight) + EPSILON,
  )
  // Maximal fit: the tighter axis is filled exactly, so nothing is padded further.
  const fillsAnAxis =
    Math.abs(scaledWidth - PNG_OUTPUT_WIDTH) < EPSILON ||
    Math.abs(scaledHeight - PNG_OUTPUT_HEIGHT) < EPSILON
  expect(fillsAnAxis).toBe(true)
}

describe('computePngLayout', () => {
  it('letterboxes a wide source (1920x1080 output, horizontal margins)', () => {
    expectFitsCanvas(3840, 1080)
    const layout = computePngLayout(3840, 1080)
    expect(layout.scale).toBeCloseTo(0.5, 6)
    expect(layout.offsetX).toBeCloseTo(0, 6)
    expect(layout.offsetY).toBeCloseTo(270, 6)
  })

  it('letterboxes a tall source (1920x1080 output, vertical margins)', () => {
    expectFitsCanvas(1080, 3840)
    const layout = computePngLayout(1080, 3840)
    expect(layout.offsetX).toBeCloseTo(808.125, 3)
    expect(layout.offsetY).toBeCloseTo(0, 6)
  })

  it('centres a square source with equal side margins', () => {
    expectFitsCanvas(1000, 1000)
    const layout = computePngLayout(1000, 1000)
    expect(layout.scale).toBeCloseTo(1.08, 6)
    expect(layout.offsetX).toBeCloseTo(420, 6)
    expect(layout.offsetY).toBeCloseTo(0, 6)
  })

  it('degrades to the full canvas for an unmeasurable source', () => {
    expect(computePngLayout(0, 0)).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      width: PNG_OUTPUT_WIDTH,
      height: PNG_OUTPUT_HEIGHT,
    })
  })
})

describe('exportGraphPng', () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear()
    stubRasterPipeline()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the graph into a 1920x1080 canvas and downloads it', () => {
    exportGraphPng(mountGraph())
    const img = createdImage()
    expect(img.requestedSrc).toBe('blob:graph')

    img.naturalWidth = 1000
    img.naturalHeight = 1000
    img.onload?.()

    const canvas = createdCanvas()
    expect(canvas.width).toBe(PNG_OUTPUT_WIDTH)
    expect(canvas.height).toBe(PNG_OUTPUT_HEIGHT)
    expect(paint.fillRect).toEqual([0, 0, PNG_OUTPUT_WIDTH, PNG_OUTPUT_HEIGHT])
    // A 1000x1000 graph fitted into 1920x1080: 1080 square, centred horizontally.
    expect(paint.drawImage).toEqual([420, 0, 1080, 1080])
    expect(downloadBlob).toHaveBeenCalledWith('knowledge-graph-2026-10-17.png', expect.any(Blob))
  })

  it('inlines computed SVG paint styles before rasterizing', async () => {
    const svg = mountGraph()
    const line = document.createElementNS(svg.namespaceURI, 'line') as SVGLineElement
    line.style.stroke = 'rgb(20, 17, 13)'
    const node = document.createElementNS(svg.namespaceURI, 'circle') as SVGCircleElement
    node.style.fill = 'rgb(154, 92, 42)'
    svg.append(line, node)

    exportGraphPng(svg)

    const serialized = await createdSvgBlob().text()
    expect(serialized).toContain('stroke: rgb(20, 17, 13)')
    expect(serialized).toContain('fill: rgb(154, 92, 42)')
  })

  it('paints the export paper when the surface has no colour of its own', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: NO_BACKGROUND,
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration)

    exportGraphPng(mountGraph())
    createdImage().onload?.()

    expect(paint.fillStyle).toBe(EXPORT_COLORS.paper)
  })

  it('paints the themed surface colour when the canvas has one', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: THEMED_BACKGROUND,
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration)

    exportGraphPng(mountGraph())
    createdImage().onload?.()

    expect(paint.fillStyle).toBe(THEMED_BACKGROUND)
  })

  it('releases the object URL and paints nothing when the graph cannot load', () => {
    exportGraphPng(mountGraph())
    createdImage().onerror?.()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:graph')
    expect(renderedCanvas).toBeNull()
  })

  it('does nothing without an svg element', () => {
    exportGraphPng(null)

    expect(renderedCanvas).toBeNull()
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})
