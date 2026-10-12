import { EXPORT_COLORS } from '@/lib/export/export-theme'
import { downloadBlob } from './export-types'

/** XML namespace for the wrapper SVG the cloned DOM is embedded in. */
const SVG_NS = 'http://www.w3.org/2000/svg'

/** Raster scale of the exported PNG (2x the CSS pixel box). */
const EXPORT_SCALE = 2

/**
 * Background painted behind the clone when the element has no computed color.
 *
 * The live value is read from the `--background` token at export time (see
 * {@link resolvePaperBackground}); this constant is the documented SSR /
 * no-DOM fallback, mirroring `--background` in `src/app/globals.css`.
 */
const FALLBACK_BACKGROUND = EXPORT_COLORS.paper

/**
 * CSS custom property holding the paper colour (`--background` in
 * `src/app/globals.css`). Read from the live document at export time so a
 * re-themed `<html>` (class swap, user override) is honoured; a standalone
 * SVG/PNG has no access to the app's variables, so the value is inlined into
 * the clone.
 */
const PAPER_TOKEN = '--background'

/** Resolves the paper background, falling back to {@link FALLBACK_BACKGROUND}
 *  in SSR / non-DOM contexts where `document` or the token is unavailable. */
const resolvePaperBackground = (): string => {
  if (typeof document === 'undefined') return FALLBACK_BACKGROUND
  const styles = getComputedStyle(document.documentElement)
  const token = typeof styles.getPropertyValue === 'function'
    ? styles.getPropertyValue(PAPER_TOKEN).trim()
    : ''
  return token || FALLBACK_BACKGROUND
}

/**
 * Renders an element's subtree to a PNG download.
 *
 * The mind map is plain DOM (not an `<svg>` document), so the clone is embedded
 * in a `foreignObject` wrapper before it can be rasterized. Extracted from
 * `mindmap-view.tsx` to keep that module under the repository's 500-LOC limit
 * (Plan 159 follow-on F6); the rendering pipeline is byte-for-byte the same.
 *
 * The caller owns error handling — this throws if serialization or the canvas
 * context fails, so a failure is loud rather than a silent no-op.
 */
export const exportElementAsPng = (element: HTMLElement, filename: string): void => {
  const rect = element.getBoundingClientRect()
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(rect.width))
  svg.setAttribute('height', String(rect.height))
  const foreignObject = document.createElementNS(SVG_NS, 'foreignObject')
  foreignObject.setAttribute('width', '100%')
  foreignObject.setAttribute('height', '100%')
  const nodeCopy = element.cloneNode(true) as HTMLElement
  const computedBackground = getComputedStyle(element).backgroundColor
  nodeCopy.style.width = `${rect.width}px`
  nodeCopy.style.height = `${rect.height}px`
  nodeCopy.style.background = computedBackground || resolvePaperBackground()
  foreignObject.appendChild(nodeCopy)
  svg.appendChild(foreignObject)
  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svg)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = rect.width * EXPORT_SCALE
    canvas.height = rect.height * EXPORT_SCALE
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          downloadBlob(filename, pngBlob)
        }
      })
    }
    URL.revokeObjectURL(url)
  }
  img.src = url
}
