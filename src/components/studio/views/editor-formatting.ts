import type { MarkdownCommandResult, MarkdownSelection } from '@/lib/editor/markdown-types'
import {
  applyBold,
  applyItalic,
  applyHeading,
  applyBulletList,
  applyOrderedList,
  applyQuote,
  applyInlineCode,
  applyLink,
} from '@/lib/editor'

/** Restores focus and selection after an editor transformation. */
export const restoreEditorSelection = (
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
): void => {
  textarea.focus()
  textarea.setSelectionRange(start, end)
}

/** Describes the textarea selection within the current content. */
const describeSelection = (
  content: string,
  textarea: HTMLTextAreaElement,
): MarkdownSelection => {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const after = content.slice(end)
  const newline = after.indexOf('\n')
  return {
    text: content.slice(start, end),
    range: { start, end },
    lineStart: content.slice(0, start).lastIndexOf('\n') + 1,
    lineEnd: newline === -1 ? content.length : end + newline,
  }
}

/** Supported toolbar/keyboard format commands (static allowlist). */
const FORMAT_COMMANDS = [
  'bold',
  'italic',
  'h1',
  'h2',
  'bullet',
  'ordered',
  'quote',
  'code',
  'link',
] as const

type FormatCommand = (typeof FORMAT_COMMANDS)[number]

const isFormatCommand = (command: string): command is FormatCommand =>
  (FORMAT_COMMANDS as readonly string[]).includes(command)

const FORMAT_HANDLERS: Record<
  FormatCommand,
  (content: string, selection: MarkdownSelection) => MarkdownCommandResult
> = {
  bold: (content, selection) => applyBold(content, selection),
  italic: (content, selection) => applyItalic(content, selection),
  h1: (content, selection) => applyHeading(content, selection, 1),
  h2: (content, selection) => applyHeading(content, selection, 2),
  bullet: (content, selection) => applyBulletList(content, selection),
  ordered: (content, selection) => applyOrderedList(content, selection),
  quote: (content, selection) => applyQuote(content, selection),
  code: (content, selection) => applyInlineCode(content, selection),
  link: (content, selection) => applyLink(content, selection),
}

/** Applies a supported markdown format command to the textarea selection. */
export const applyEditorFormat = (
  content: string,
  command: string,
  textarea: HTMLTextAreaElement,
): MarkdownCommandResult | null => {
  if (!isFormatCommand(command)) return null
  return FORMAT_HANDLERS[command](content, describeSelection(content, textarea))
}
