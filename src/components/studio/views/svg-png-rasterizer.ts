/** Presentation styles unavailable once the serialized SVG leaves the document. */
const INLINE_STYLE_PROPERTIES = [
  'color',
  'dominant-baseline',
  'filter',
  'fill',
  'fill-opacity',
  'fill-rule',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'opacity',
  'paint-order',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'visibility',
] as const

/** SVG images do not inherit this document's stylesheets; preserve computed paint values. */
const cloneWithComputedStyles = (svg: SVGSVGElement): SVGSVGElement => {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const sourceElements = [svg, ...Array.from(svg.querySelectorAll<SVGElement>('*'))]
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))]

  sourceElements.forEach((source, index) => {
    const target = cloneElements[index]
    if (!target) return

    const computed = getComputedStyle(source)
    for (const property of INLINE_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property)
      if (value !== '') target.style.setProperty(property, value)
    }
  })

  return clone
}

export interface SvgPngRasterOptions {
  width: number
  height: number
  draw: (context: CanvasRenderingContext2D, image: HTMLImageElement) => void
  onPng: (blob: Blob) => void
}

/** Rasterizes an SVG element into a caller-sized PNG, preserving caller drawing semantics. */
export const rasterizeSvgToPng = (
  svg: SVGSVGElement,
  { width, height, draw, onPng }: SvgPngRasterOptions,
): void => {
  const serializedSvg = new XMLSerializer().serializeToString(cloneWithComputedStyles(svg))
  const svgBlob = new Blob([serializedSvg], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(svgBlob)
  const image = new Image()
  const releaseUrl = (): void => URL.revokeObjectURL(url)
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return
      draw(context, image)
      canvas.toBlob((blob) => {
        if (blob) onPng(blob)
      }, 'image/png')
    } finally {
      releaseUrl()
    }
  }
  image.onerror = releaseUrl
  image.src = url
}
