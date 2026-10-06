/**
 * Grapheme-safe text utilities using Intl.Segmenter.
 */

let graphemeSegmenter: Intl.Segmenter | null = null

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (graphemeSegmenter !== null) return graphemeSegmenter
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      return graphemeSegmenter
    } catch {
      return null
    }
  }
  return null
}

/**
 * Truncates `text` to at most `maxGraphemes` user-perceived graphemes,
 * appending `ellipsis` if truncated.
 */
export function truncateGraphemes(
  text: string,
  maxGraphemes: number,
  ellipsis = '…',
): string {
  if (!text) return ''
  const segmenter = getGraphemeSegmenter()
  if (segmenter) {
    const segments = Array.from(segmenter.segment(text))
    if (segments.length <= maxGraphemes) return text
    const cutCount = Math.max(1, maxGraphemes - ellipsis.length)
    return segments.slice(0, cutCount).map((s) => s.segment).join('') + ellipsis
  }

  // Fallback for legacy environments without Intl.Segmenter
  const graphemes = Array.from(text)
  if (graphemes.length <= maxGraphemes) return text
  const cutCount = Math.max(1, maxGraphemes - ellipsis.length)
  return graphemes.slice(0, cutCount).join('') + ellipsis
}
