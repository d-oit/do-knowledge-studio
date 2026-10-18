/** Resolves a CSS length in rem or px against the document root. */
const resolveLengthPx = (raw: string, root: HTMLElement): number | null => {
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return null
  if (raw.endsWith('rem')) {
    const rootFontPx = Number.parseFloat(getComputedStyle(root).fontSize) || 16
    return value * rootFontPx
  }
  if (raw.endsWith('px')) return value
  return null
}

/** Reads a Tailwind breakpoint theme token as pixels. */
export const readBreakpointPx = (name: string): number | null => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null
  const root = document.documentElement
  const raw = getComputedStyle(root).getPropertyValue(name).trim()
  return raw ? resolveLengthPx(raw, root) : null
}
