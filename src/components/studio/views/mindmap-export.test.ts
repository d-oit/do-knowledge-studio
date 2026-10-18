import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import html2canvas from 'html2canvas'
import { exportElementAsPng } from './mindmap-export'
import { downloadBlob } from './export-types'

vi.mock('./export-types', () => ({ downloadBlob: vi.fn() }))
vi.mock('html2canvas', () => ({ default: vi.fn() }))

/** Filename used by the assertions; the name itself is the caller's choice. */
const FILENAME = 'mindmap-test.png'

/** What a browser reports for a transparent element. */
const NO_BACKGROUND = 'rgba(0, 0, 0, 0)'

/** Fallback painted behind transparent content (mirrors the paper token). */
const EXPECTED_FALLBACK_BACKGROUND = '#faf8f3'
/** Expected high-resolution scale for exported mind maps. */
const EXPECTED_EXPORT_SCALE = 2

/** Stubs the browser canvas encoder used after html2canvas renders the element. */
const stubCanvasEncoding = (): void => {
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(['png'], { type: 'image/png' }))
  })
}

describe('exportElementAsPng', () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockClear()
    vi.mocked(html2canvas).mockReset()
    vi.mocked(html2canvas).mockResolvedValue(document.createElement('canvas'))
    stubCanvasEncoding()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      backgroundColor: NO_BACKGROUND,
    } as CSSStyleDeclaration)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the element at high resolution and downloads a PNG', async () => {
    const element = document.createElement('div')

    await exportElementAsPng(element, FILENAME)

    expect(html2canvas).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        backgroundColor: EXPECTED_FALLBACK_BACKGROUND,
        scale: EXPECTED_EXPORT_SCALE,
      }),
    )
    const [name, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(name).toBe(FILENAME)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
  })

  it('uses the document background when the mind map canvas is transparent', async () => {
    const element = document.createElement('div')
    const documentBackground = 'rgb(12, 34, 56)'
    vi.mocked(window.getComputedStyle).mockImplementation((target: Element) => ({
      backgroundColor: target === document.documentElement
        ? documentBackground
        : NO_BACKGROUND,
    } as CSSStyleDeclaration))

    await exportElementAsPng(element, FILENAME)

    expect(html2canvas).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        backgroundColor: documentBackground,
        scale: EXPECTED_EXPORT_SCALE,
      }),
    )
  })

  it('prefers a painted canvas background over the document background', async () => {
    const element = document.createElement('div')
    const canvasBackground = 'rgb(40, 50, 60)'
    vi.mocked(window.getComputedStyle).mockImplementation((target: Element) => ({
      backgroundColor: target === element ? canvasBackground : 'rgb(12, 34, 56)',
    } as CSSStyleDeclaration))

    await exportElementAsPng(element, FILENAME)

    expect(html2canvas).toHaveBeenCalledWith(
      element,
      expect.objectContaining({
        backgroundColor: canvasBackground,
        scale: EXPECTED_EXPORT_SCALE,
      }),
    )
  })

  it('normalizes unsupported CSS colour functions in the capture clone', async () => {
    await exportElementAsPng(document.createElement('div'), FILENAME)
    const clonedRoot = document.createElement('div')
    const modernColor = 'oklab(0.53546 0.056891 0.0866667 / 0.4)'
    vi.mocked(window.getComputedStyle).mockImplementation((target: Element) => ({
      backgroundColor: NO_BACKGROUND,
      getPropertyValue: (property: string) =>
        target === clonedRoot && property === 'outline-color' ? modernColor : '',
    } as CSSStyleDeclaration))
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([120, 80, 40, 102]) }),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    const onclone = vi.mocked(html2canvas).mock.calls[0][1]?.onclone
    if (!onclone) throw new Error('html2canvas clone normalization was not configured')

    onclone(document, clonedRoot)

    expect(clonedRoot.style.getPropertyValue('outline-color')).toBe('rgba(120, 80, 40, 0.4)')
  })

  it('rejects when the canvas encoder returns no PNG data', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(null)
    })

    await expect(exportElementAsPng(document.createElement('div'), FILENAME))
      .rejects.toThrow('The browser returned no PNG data.')
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('propagates rendering failures without downloading a file', async () => {
    vi.mocked(html2canvas).mockRejectedValue(new Error('capture failed'))

    await expect(exportElementAsPng(document.createElement('div'), FILENAME))
      .rejects.toThrow('capture failed')
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})
