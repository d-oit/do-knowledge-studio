import { describe, it, expect } from 'vitest'
import { applyBold, applyItalic, applyHeading, applyBulletList, applyOrderedList, applyQuote, applyInlineCode, applyLink } from './formatting'
import type { MarkdownSelection } from './markdown-types'

function sel(text: string, start: number, end: number): MarkdownSelection {
  const before = text.slice(0, start)
  const after = text.slice(end)
  const lineStart = before.lastIndexOf('\n') + 1
  const nextNewline = after.indexOf('\n')
  const lineEnd = nextNewline === -1 ? text.length : end + nextNewline
  return {
    text: text.slice(start, end),
    range: { start, end },
    lineStart,
    lineEnd,
  }
}

describe('applyBold', () => {
  it('wraps selected text with **', () => {
    const result = applyBold('hello world', sel('hello world', 0, 5))
    expect(result.text).toBe('**hello** world')
  })

  it('inserts markers on collapsed selection', () => {
    const result = applyBold('hello world', sel('hello world', 5, 5))
    expect(result.text).toBe('hello**** world')
    expect(result.selection.start).toBe(7)
  })

  it('unwraps already bold text', () => {
    const result = applyBold('**hello** world', sel('**hello** world', 0, 9))
    expect(result.text).toBe('hello world')
  })

  it('handles empty text', () => {
    const result = applyBold('', sel('', 0, 0))
    expect(result.text).toBe('****')
    expect(result.selection.start).toBe(2)
  })
})

describe('applyItalic', () => {
  it('wraps selected text with _', () => {
    const result = applyItalic('hello world', sel('hello world', 0, 5))
    expect(result.text).toBe('_hello_ world')
  })

  it('inserts markers on collapsed selection', () => {
    const result = applyItalic('hello world', sel('hello world', 5, 5))
    expect(result.text).toBe('hello__ world')
  })

  it('unwraps already italic text', () => {
    const result = applyItalic('_hello_ world', sel('_hello_ world', 0, 7))
    expect(result.text).toBe('hello world')
  })
})

describe('applyHeading', () => {
  it('adds heading prefix to current line', () => {
    const result = applyHeading('hello world', sel('hello world', 0, 0), 1)
    expect(result.text).toBe('# hello world')
  })

  it('toggles existing heading', () => {
    const result = applyHeading('# hello world', sel('# hello world', 2, 2), 1)
    expect(result.text).toBe('hello world')
  })

  it('applies H2 prefix', () => {
    const result = applyHeading('hello', sel('hello', 0, 0), 2)
    expect(result.text).toBe('## hello')
  })
})

describe('applyBulletList', () => {
  it('adds bullet prefix', () => {
    const result = applyBulletList('item', sel('item', 0, 0))
    expect(result.text).toBe('- item')
  })

  it('toggles existing bullet', () => {
    const result = applyBulletList('- item', sel('- item', 0, 0))
    expect(result.text).toBe('item')
  })

  it('handles multiline selection', () => {
    const text = 'line 1\nline 2\nline 3'
    const result = applyBulletList(text, sel(text, 0, 17))
    expect(result.text).toBe('- line 1\n- line 2\n- line 3')
    expect(result.selection.end).toBe(23)
  })
})

describe('applyOrderedList', () => {
  it('adds ordered list prefix', () => {
    const result = applyOrderedList('item', sel('item', 0, 0))
    expect(result.text).toBe('1. item')
  })

  it('toggles existing ordered list', () => {
    const result = applyOrderedList('1. item', sel('1. item', 0, 0))
    expect(result.text).toBe('item')
  })
})

describe('applyQuote', () => {
  it('adds quote prefix', () => {
    const result = applyQuote('hello', sel('hello', 0, 0))
    expect(result.text).toBe('> hello')
  })

  it('toggles existing quote', () => {
    const result = applyQuote('> hello', sel('> hello', 0, 0))
    expect(result.text).toBe('hello')
  })
})

describe('applyInlineCode', () => {
  it('wraps selected text with backticks', () => {
    const result = applyInlineCode('useState', sel('useState', 0, 8))
    expect(result.text).toBe('`useState`')
  })

  it('unwraps already code text', () => {
    const result = applyInlineCode('`useState`', sel('`useState`', 0, 10))
    expect(result.text).toBe('useState')
  })
})

describe('applyLink', () => {
  it('inserts link at collapsed selection', () => {
    const result = applyLink('hello world', sel('hello world', 6, 6))
    expect(result.text).toBe('hello [text](url)world')
  })

  it('wraps selected text as link label', () => {
    const result = applyLink('hello world', sel('hello world', 0, 5))
    expect(result.text).toBe('[hello](url) world')
  })
})

describe('edge cases', () => {
  it('preserves non-selected text with bold', () => {
    const result = applyBold('a b c', sel('a b c', 2, 3))
    expect(result.text).toBe('a **b** c')
  })

  it('handles single character selection', () => {
    const result = applyItalic('x', sel('x', 0, 1))
    expect(result.text).toBe('_x_')
  })

  it('does not destroy line endings for multiline bold', () => {
    const text = 'hello\nworld'
    const result = applyBold(text, sel(text, 0, 11))
    expect(result.text).toBe('**hello\nworld**')
  })
})