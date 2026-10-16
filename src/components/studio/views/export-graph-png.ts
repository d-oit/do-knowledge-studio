import { downloadBlob, todayStamp } from './export-types'

/** Renders the live SVG canvas into a 2x PNG and downloads it. */
export const exportGraphPng = (svg: SVGSVGElement | null): void => {
  if (!svg) return

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svg)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * 2
      canvas.height = img.naturalHeight * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) return
        downloadBlob(`knowledge-graph-${todayStamp()}.png`, blob)
      }, 'image/png')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  img.src = url
}
