import { EXPORT_COLORS } from '@/lib/export/export-theme'
import { downloadBlob, todayStamp } from './export-types'
import { rasterizeSvgToPng } from './svg-png-rasterizer'

/** Output width of the exported graph PNG (Plan 20: "1080p PNG"). */
export const PNG_OUTPUT_WIDTH = 1920

/** Output height of the exported graph PNG (Plan 20: "1080p PNG"). */
export const PNG_OUTPUT_HEIGHT = 1080

/**
 * Background painted behind the graph when the surface it sits on reports no
 * colour of its own (no DOM, or a transparent wrapper). It is the export
 * palette's paper — the same fallback `mindmap-export.ts` uses, so every
 * exported image starts from one background.
 */
const FALLBACK_BACKGROUND = EXPORT_COLORS.paper

/**
 * What `getComputedStyle` reports for a transparent element in a browser
 * (jsdom reports an empty string, hence both values are checked).
 */
const TRANSPARENT_BACKGROUND = 'rgba(0, 0, 0, 0)'

/** Scale and placement of the graph inside the fixed export canvas. */
export interface PngLayout {
  /** Multiplier applied to the source graph. */
  scale: number
  /** Left inset of the scaled graph inside the output canvas. */
  offsetX: number
  /** Top inset of the scaled graph inside the output canvas. */
  offsetY: number
  /** Output canvas width in pixels. */
  width: number
  /** Output canvas height in pixels. */
  height: number
}

/**
 * Fits a `sourceWidth`×`sourceHeight` graph inside the fixed export canvas.
 *
 * Pure so the letterboxing maths is testable without a canvas: the graph keeps
 * its aspect ratio, is centred, and never overflows the output box — `scale` is
 * at most `min(1920 / w, 1080 / h)`. A non-positive source cannot be divided
 * by, so it degrades to the full canvas instead of producing `Infinity`.
 * @param sourceWidth - Width of the source graph.
 * @param sourceHeight - Height of the source graph.
 * @returns The scale, the centring offsets, and the fixed output size.
 */
export const computePngLayout = (sourceWidth: number, sourceHeight: number): PngLayout => {
  /** The source box; the output box stands in when the source is unmeasurable. */
  const width = sourceWidth > 0 ? sourceWidth : PNG_OUTPUT_WIDTH
  const height = sourceHeight > 0 ? sourceHeight : PNG_OUTPUT_HEIGHT
  /** The largest multiplier that still fits both output axes. */
  const scale = Math.min(PNG_OUTPUT_WIDTH / width, PNG_OUTPUT_HEIGHT / height)
  return {
    scale,
    offsetX: (PNG_OUTPUT_WIDTH - width * scale) / 2,
    offsetY: (PNG_OUTPUT_HEIGHT - height * scale) / 2,
    width: PNG_OUTPUT_WIDTH,
    height: PNG_OUTPUT_HEIGHT,
  }
}

/**
 * Resolves the colour painted behind the exported graph.
 *
 * The live canvas surface is themed (`--background` in `src/app/globals.css`),
 * so reading its computed colour keeps a dark-mode export legible instead of
 * putting light-on-dark node labels on paper. The token value is unavailable
 * once the PNG leaves the document, which is why the fallback exists.
 * @param svg - The live graph element whose parent paints the canvas surface.
 * @returns A CSS colour string for the letterboxed margins.
 */
const resolveExportBackground = (svg: SVGSVGElement): string => {
  if (typeof getComputedStyle !== 'function') return FALLBACK_BACKGROUND
  /** The element the canvas surface is painted on. */
  const surface = svg.parentElement
  const painted = surface ? getComputedStyle(surface).backgroundColor : ''
  return painted !== '' && painted !== TRANSPARENT_BACKGROUND ? painted : FALLBACK_BACKGROUND
}

/** Renders the live SVG graph into a 1920×1080 PNG and downloads it. */
export const exportGraphPng = (svg: SVGSVGElement | null): void => {
  if (!svg) return

  rasterizeSvgToPng(svg, {
    width: PNG_OUTPUT_WIDTH,
    height: PNG_OUTPUT_HEIGHT,
    draw: (ctx, img) => {
      /** The fixed-canvas placement for the graph's intrinsic size. */
      const layout = computePngLayout(img.naturalWidth, img.naturalHeight)
      ctx.fillStyle = resolveExportBackground(svg)
      ctx.fillRect(0, 0, layout.width, layout.height)
      ctx.drawImage(
        img,
        layout.offsetX,
        layout.offsetY,
        img.naturalWidth * layout.scale,
        img.naturalHeight * layout.scale,
      )
    },
    onPng: (blob) => downloadBlob(`knowledge-graph-${todayStamp()}.png`, blob),
  })
}
