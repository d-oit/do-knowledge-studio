export interface MarkdownRange {
  start: number
  end: number
}

export interface MarkdownSelection {
  text: string
  range: MarkdownRange
  lineStart: number
  lineEnd: number
}

export interface MarkdownCommandResult {
  text: string
  selection: MarkdownRange
}

export type MarkdownCommand = (
  text: string,
  selection: MarkdownSelection,
) => MarkdownCommandResult