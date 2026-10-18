import { EXPORT_COLORS } from '@/lib/export/export-theme'
import html2canvas from 'html2canvas'
import { downloadBlob } from './export-types'

/** Raster scale of the exported PNG (2x the CSS pixel box). */
const EXPORT_SCALE = 2

/** Background used when neither the canvas nor the document paints a colour. */
const FALLBACK_BACKGROUND = EXPORT_COLORS.paper

/** What a transparent element reports in a browser. */
const TRANSPARENT_BACKGROUND = 'rgba(0, 0, 0, 0)'
/** One-pixel canvas used to convert CSS colours into canvas-supported RGB. */
const COLOR_SAMPLE_SIZE_PX = 1
/** Alpha byte value representing an opaque color. */
const OPAQUE_ALPHA_VALUE = 255
/** Precision retained when converting an 8-bit alpha channel to CSS. */
const ALPHA_DECIMAL_PLACES = 3

/** True when a computed background is a colour rather than transparency. */
const hasPaintedBackground = (backgroundColor: string): boolean =>
  backgroundColor !== '' &&
  backgroundColor !== 'transparent' &&
  backgroundColor !== TRANSPARENT_BACKGROUND

/** CSS colour functions html2canvas 1.4 does not parse. */
const UNSUPPORTED_COLOR_FUNCTION = /^(?:oklab|oklch|lab|lch|color-mix)\(/i

/** SVG/CSS colour properties that can contain modern theme colours. */
const COLOR_PROPERTIES = [
  'accent-color',
  'background-color',
  'border-block-end-color',
  'border-block-start-color',
  'border-bottom-color',
  'border-color',
  'border-inline-end-color',
  'border-inline-start-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
  'caret-color',
  'color',
  'fill',
  'outline-color',
  'stroke',
  'text-decoration-color',
] as const

/** Normalizes a browser-supported CSS colour function to a CSS RGB colour. */
const normalizeCssColor = (context: CanvasRenderingContext2D, color: string): string => {
  context.clearRect(0, 0, COLOR_SAMPLE_SIZE_PX, COLOR_SAMPLE_SIZE_PX)
  context.fillStyle = color
  context.fillRect(0, 0, COLOR_SAMPLE_SIZE_PX, COLOR_SAMPLE_SIZE_PX)
  const [red, green, blue, alpha] = context.getImageData(
    0,
    0,
    COLOR_SAMPLE_SIZE_PX,
    COLOR_SAMPLE_SIZE_PX,
  ).data
  if (alpha === OPAQUE_ALPHA_VALUE) return `rgb(${red}, ${green}, ${blue})`
  return `rgba(${red}, ${green}, ${blue}, ${Number((alpha / OPAQUE_ALPHA_VALUE).toFixed(ALPHA_DECIMAL_PLACES))})`
}

/** Prepares html2canvas's private clone for modern theme colors and full labels. */
const prepareCaptureClone = (clonedDocument: Document, clonedRoot: HTMLElement): void => {
  const clonedWindow = clonedDocument.defaultView
  if (!clonedWindow) return

  const sampleCanvas = clonedDocument.createElement('canvas')
  let context: CanvasRenderingContext2D | null = null
  const elements = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement | SVGElement>('*'))]

  for (const element of elements) {
    const styles = clonedWindow.getComputedStyle(element)
    for (const property of COLOR_PROPERTIES) {
      const color = styles.getPropertyValue(property).trim()
      if (!UNSUPPORTED_COLOR_FUNCTION.test(color)) continue
      context ??= sampleCanvas.getContext('2d')
      if (!context) throw new Error('Could not prepare PNG colour normalization.')
      element.style.setProperty(property, normalizeCssColor(context, color))
    }
  }
  // Preserve full labels: html2canvas clips the baseline when `truncate` overflows.
  for (const label of clonedRoot.querySelectorAll<HTMLElement>('.truncate')) {
    label.style.overflow = 'visible'
  }
}
/** Resolves an actual CSS colour so the standalone capture preserves both themes. */
const resolvePaperBackground = (element: HTMLElement): string => {
  if (typeof getComputedStyle !== 'function') return FALLBACK_BACKGROUND

  const elementBackground = getComputedStyle(element).backgroundColor
  if (hasPaintedBackground(elementBackground)) return elementBackground

  if (typeof document === 'undefined') return FALLBACK_BACKGROUND
  const documentBackground = getComputedStyle(document.documentElement).backgroundColor
  return hasPaintedBackground(documentBackground) ? documentBackground : FALLBACK_BACKGROUND
}

/**
 * Captures the rendered mind map as a PNG.
 *
 * The SVG `foreignObject` path taints browser canvases, so use html2canvas to
 * paint the live DOM tree directly. The caller owns error handling.
 */
export const exportElementAsPng = async (element: HTMLElement, filename: string): Promise<void> => {
  const canvas = await html2canvas(element, {
    backgroundColor: resolvePaperBackground(element),
    scale: EXPORT_SCALE,
    onclone: prepareCaptureClone,
  })
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((png) => {
      if (!png) {
        reject(new Error('The browser returned no PNG data.'))
        return
      }
      resolve(png)
    }, 'image/png')
  })
  downloadBlob(filename, blob)
}
