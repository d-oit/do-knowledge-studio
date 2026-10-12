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
    // also the path a real unstyled container takes. `getComputedStyle` is
    // mocked to report no custom properties either, which is what SSR and a
    // document without the app stylesheet look like.
    const cloneSpy = vi.spyOn(element, 'cloneNode').mockReturnValue(clone as unknown as Node)

    exportElementAsPng(element, FILENAME)

    expect(cloneSpy).toHaveBeenCalledWith(true)
    // Compare through a probe element: the CSSOM normalizes hex to `rgb(...)`,
    // so asserting the literal hex would fail on formatting rather than value.
    const probe = document.createElement('div')
    probe.style.background = EXPECTED_FALLBACK_BACKGROUND
    expect(clone.style.background).toBe(probe.style.background)
  })

  it('reads the paper token from the document when one is available', () => {
    const PAPER_FROM_TOKEN = 'rgb(12, 34, 56)'
    // Ask for a *named* property and refuse anything else: a mock that returns
    // the paper colour for any argument passes even when the production code
    // reads a misspelled custom property, which is the failure mode this test
    // exists to catch (review on #938).
    const requestedProperties: string[] = []
    const queriedElements: Element[] = []
    vi.mocked(window.getComputedStyle).mockImplementation((element: Element) => {
      queriedElements.push(element)
      return {
        backgroundColor: NO_BACKGROUND,
        getPropertyValue: (property: string) => {
          requestedProperties.push(property)
          if (property !== '--background') {
            throw new Error(`unexpected custom property read: ${property}`)
          }
          return PAPER_FROM_TOKEN
        },
      } as unknown as CSSStyleDeclaration
    })
    const element = document.createElement('div')
    const clone = document.createElement('div')
    vi.spyOn(element, 'cloneNode').mockReturnValue(clone as unknown as Node)

    exportElementAsPng(element, FILENAME)

    expect(clone.style.background).toBe(PAPER_FROM_TOKEN)
    // Both halves of the contract are pinned: *which* custom property the view
    // reads (`--background` is the paper colour in both themes — see
    // `PAPER_TOKEN`) and *where* it reads it. The token lives on the root
    // element, so a mock that answers for any element would hide a regression
    // that queried the wrong one (review on #938).
    expect(requestedProperties).toEqual(['--background'])
    // The export also computes styles for the element it rasterizes, so the
    // root must be *one* of the queried targets — asserting exact equality
    // would pin the unrelated call count instead of the token's home.
    expect(queriedElements).toContain(document.documentElement)
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
