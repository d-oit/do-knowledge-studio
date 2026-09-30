import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { exportElementAsPng } from './mindmap-export'
import { downloadBlob } from './export-types'

vi.mock('./export-types', () => ({ downloadBlob: vi.fn() }))

/** Filename used by the assertions; the name itself is the caller's choice. */
const FILENAME = 'mindmap-test.png'

/** What `getComputedStyle` reports when nothing paints a background. */
const NO_BACKGROUND = ''

/** Fallback painted behind the clone (mirrors the module's constant). */
const EXPECTED_FALLBACK_BACKGROUND = '#faf8f3'

/**
 * Installs the DOM APIs the raster pipeline needs — jsdom ships none of
 * `createObjectURL`, a loadable `Image`, or a working `canvas.toBlob`.
 */
const stubRasterPipeline = (): void => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(['png'], { type: 'image/png' }))
  })
  vi.stubGlobal(
    'Image',
    class MockImage {
      onload: (() => void) | null = null
      naturalWidth = 1
      naturalHeight = 1
      set src(_value: string) {
        // `onload` is assigned after construction, so fire on the next tick.
        queueMicrotask(() => {
          this.onload?.()
        })
      }
    },
  )
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
}

describe('exportElementAsPng', () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear()
    stubRasterPipeline()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: NO_BACKGROUND,
    } as CSSStyleDeclaration)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('downloads the rasterized element as a PNG under the given filename', async () => {
    const element = document.createElement('div')

    exportElementAsPng(element, FILENAME)

    await vi.waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1)
    })
    const [name, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(name).toBe(FILENAME)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
  })

  it('paints a fallback background on the clone when the element has none', () => {
    const element = document.createElement('div')
    const clone = document.createElement('div')
    // jsdom reports an empty computed background for every element, so this is
    // also the path a real unstyled container takes.
    const cloneSpy = vi.spyOn(element, 'cloneNode').mockReturnValue(clone as unknown as Node)

    exportElementAsPng(element, FILENAME)

    expect(cloneSpy).toHaveBeenCalledWith(true)
    // Compare through a probe element: the CSSOM normalizes hex to `rgb(...)`,
    // so asserting the literal hex would fail on formatting rather than value.
    const probe = document.createElement('div')
    probe.style.background = EXPECTED_FALLBACK_BACKGROUND
    expect(clone.style.background).toBe(probe.style.background)
  })

  it('sizes the clone to the element box so the raster matches the canvas', () => {
    const element = document.createElement('div')
    const clone = document.createElement('div')
    vi.spyOn(element, 'cloneNode').mockReturnValue(clone as unknown as Node)

    exportElementAsPng(element, FILENAME)

    expect(clone.style.width).toBe('0px')
    expect(clone.style.height).toBe('0px')
  })

  it('propagates a serialization failure instead of downloading a broken file', () => {
    vi.stubGlobal(
      'XMLSerializer',
      class {
        serializeToString(): string {
          throw new Error('cannot serialize')
        }
      },
    )
    const element = document.createElement('div')

    expect(() => {
      exportElementAsPng(element, FILENAME)
    }).toThrow('cannot serialize')
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})
