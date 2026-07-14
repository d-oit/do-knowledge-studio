import type { MarkdownSelection, MarkdownCommandResult } from './markdown-types'

function wrapInlineMarker(
  text: string,
  sel: MarkdownSelection,
  marker: string,
): MarkdownCommandResult {
  const { text: selected, range } = sel
  if (!selected) {
    const insertion = `${marker}${marker}`
    const newText = text.slice(0, range.start) + insertion + text.slice(range.end)
    return { text: newText, selection: { start: range.start + marker.length, end: range.start + marker.length } }
  }
  // Unwrap: selected text starts and ends with the marker
  if (selected.startsWith(marker) && selected.endsWith(marker)) {
    const unwrapped = selected.slice(marker.length, -marker.length)
    return {
      text: text.slice(0, range.start) + unwrapped + text.slice(range.end),
      selection: { start: range.start, end: range.end - marker.length * 2 },
    }
  }
  // Wrap
  return {
    text: text.slice(0, range.start) + marker + selected + marker + text.slice(range.end),
    selection: { start: range.start + marker.length, end: range.end + marker.length },
  }
}

function toggleLinePrefix(
  text: string,
  sel: MarkdownSelection,
  prefix: string,
): MarkdownCommandResult {
  const lines = text.split('\n')
  const startLine = text.slice(0, sel.range.start).split('\n').length - 1
  const endLine = text.slice(0, sel.range.end).split('\n').length - 1
  let allHavePrefix = true
  for (let i = startLine; i <= endLine; i++) {
    if (!lines[i].startsWith(prefix)) {
      allHavePrefix = false
      break
    }
  }
  for (let i = startLine; i <= endLine; i++) {
    if (allHavePrefix) {
      lines[i] = lines[i].slice(prefix.length)
    } else {
      lines[i] = prefix + lines[i]
    }
  }
  const newText = lines.join('\n')
  const prefixDelta = allHavePrefix ? -prefix.length * (endLine - startLine + 1) : prefix.length * (endLine - startLine + 1)
  return {
    text: newText,
    selection: { start: sel.range.start, end: sel.range.end + prefixDelta },
  }
}

export function applyBold(text: string, sel: MarkdownSelection): MarkdownCommandResult {
  return wrapInlineMarker(text, sel, '**')
}

export function applyItalic(text: string, sel: MarkdownSelection): MarkdownCommandResult {
  return wrapInlineMarker(text, sel, '_')
}

export function applyHeading(text: string, sel: MarkdownSelection, level: 1 | 2 | 3): MarkdownCommandResult {
  const prefix = '#'.repeat(level) + ' '
  return toggleLinePrefix(text, sel, prefix)
}

export function applyBulletList(text: string, sel: MarkdownSelection): MarkdownCommandResult {
  return toggleLinePrefix(text, sel, '- ')
}

export function applyOrderedList(text: string, sel: MarkdownSelection): MarkdownCommandResult {
  const lines = text.split('\n')
  const startLine = text.slice(0, sel.range.start).split('\n').length - 1
  const endLine = text.slice(0, sel.range.end).split('\n').length - 1
  let allHavePrefix = true
  for (let i = startLine; i <= endLine; i++) {
    if (!/^\d+\.\s/.test(lines[i])) {
      allHavePrefix = false
      break
    }
  }
  for (let i = startLine; i <= endLine; i++) {
    if (allHavePrefix) {
      lines[i] = lines[i].replace(/^\d+\.\s/, '')
    } else {
      lines[i] = `${i - startLine + 1}. ${lines[i]}`
    }
  }
  const newText = lines.join('\n')
  return { text: newText, selection: { start: sel.range.start, end: sel.range.end } }
}

export function applyQuote(text: string, sel: MarkdownSelection): MarkdownCommandResult {
  return toggleLinePrefix(text, sel, '> ')
}

export function applyInlineCode(text: string, sel: MarkdownSelection): MarkdownCommandResult {
  return wrapInlineMarker(text, sel, '`')
}

export function applyLink(text: string, sel: MarkdownSelection): MarkdownCommandResult {
  const { text: selected, range } = sel
  if (!selected) {
    const insertion = '[text](url)'
    return {
      text: text.slice(0, range.start) + insertion + text.slice(range.end),
      selection: { start: range.start + 1, end: range.start + 5 },
    }
  }
  const linkText = `[${selected}](url)`
  return {
    text: text.slice(0, range.start) + linkText + text.slice(range.end),
    selection: { start: range.start + selected.length + 3, end: range.start + selected.length + 6 },
  }
}