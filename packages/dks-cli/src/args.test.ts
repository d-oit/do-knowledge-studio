import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIMIT,
  MAX_RANGE_LIMIT,
  MIN_LIMIT,
  argvHasFlag,
  globalFlagsHint,
  parseInvocation,
  parseLimit,
  parseLocalFlags,
} from './args.js'
import { CliError } from './errors.js'

describe('parseInvocation', () => {
  it('splits command, operands, and default flags', () => {
    const invocation = parseInvocation(['entity', 'note/x'])
    expect(invocation.command).toBe('entity')
    expect(invocation.args).toEqual(['note/x'])
    expect(invocation.flags.format).toBe('text')
    expect(invocation.flags.quiet).toBe(false)
    expect(invocation.flags.noColor).toBe(false)
    expect(invocation.flags.limit).toBeUndefined()
    expect(invocation.flags.bundle).toBeUndefined()
  })

  it('accepts global flags before the subcommand', () => {
    const invocation = parseInvocation(['--format', 'json', '--limit', '5', 'search', 'graph'])
    expect(invocation.command).toBe('search')
    expect(invocation.flags.format).toBe('json')
    expect(invocation.flags.limit).toBe(5)
    expect(invocation.args).toEqual(['graph'])
  })

  it('accepts global flags after the subcommand', () => {
    const invocation = parseInvocation(['search', 'graph', '--format', 'json', '--quiet', '--no-color'])
    expect(invocation.command).toBe('search')
    expect(invocation.flags.format).toBe('json')
    expect(invocation.flags.quiet).toBe(true)
    expect(invocation.flags.noColor).toBe(true)
  })

  it('accepts --verbose as a global boolean without consuming a value', () => {
    const invocation = parseInvocation(['--verbose', 'search', 'graph'])
    expect(invocation.command).toBe('search')
    expect(invocation.flags.verbose).toBe(true)
    expect(invocation.args).toEqual(['graph'])
    expect(parseInvocation(['search', 'graph']).flags.verbose).toBe(false)
  })

  it('treats --help and -h as the help command anywhere', () => {
    expect(parseInvocation(['--help']).command).toBe('help')
    expect(parseInvocation(['-h']).command).toBe('help')
    expect(parseInvocation(['search', '--help']).command).toBe('help')
  })

  it('turns the preceding command, not its operands, into the help topic', () => {
    const invocation = parseInvocation(['search', 'graph', '--help', 'extra'])
    expect(invocation.command).toBe('help')
    expect(invocation.args).toEqual(['search'])
  })

  it('lets bund flag value default through flags', () => {
    const invocation = parseInvocation(['--bundle', './my/knowledge', 'doctor'])
    expect(invocation.flags.bundle).toBe('./my/knowledge')
  })

  it('rejects --format values other than json|text', () => {
    expect(() => parseInvocation(['--format', 'yaml', 'doctor'])).toThrowError(CliError)
    expect(() => parseInvocation(['--format', 'jsonx'])).toThrowError(/"json" or "text"/)
  })

  it('rejects a value flag without its value', () => {
    expect(() => parseInvocation(['--limit'])).toThrowError(/missing its value/)
    expect(() => parseInvocation(['--bundle'])).toThrowError(/missing its value/)
  })

  it('rejects unknown single-dash options', () => {
    expect(() => parseInvocation(['-x'])).toThrowError(CliError)
    expect(() => parseInvocation(['-x'])).toThrowError(/unknown option/)
  })

  it('keeps the bare - stdin placeholder as an operand', () => {
    expect(parseInvocation(['backup', 'verify', '-']).args).toEqual(['verify', '-'])
  })
})

describe('parseLimit', () => {
  it('parses integers', () => {
    expect(parseLimit('5')).toBe(5)
  })

  it('clamps below the minimum to 1', () => {
    expect(parseLimit('0')).toBe(MIN_LIMIT)
    expect(parseLimit('-3')).toBe(MIN_LIMIT)
  })

  it('clamps above the cap to 200', () => {
    expect(parseLimit('5000')).toBe(MAX_RANGE_LIMIT)
    expect(MAX_RANGE_LIMIT).toBe(200)
  })

  it('keeps the default at 20', () => {
    expect(DEFAULT_LIMIT).toBe(20)
  })

  it('rejects non-numeric and non-integer values', () => {
    expect(() => parseLimit('abc')).toThrowError(CliError)
    expect(() => parseLimit('2.5')).toThrowError(/integer/)
  })
})

describe('parseLocalFlags', () => {
  it('splits operands and options', () => {
    const parsed = parseLocalFlags(['neighbors', 'x/y', '--depth', '2'], ['--depth'])
    expect(parsed.operands).toEqual(['neighbors', 'x/y'])
    expect(parsed.options.get('--depth')).toBe('2')
  })

  it('errors on unknown local flags', () => {
    expect(() => parseLocalFlags(['--depth', '2'], [])).toThrowError(CliError)
    expect(() => parseLocalFlags(['--bogus'], ['--depth'])).toThrowError(/unknown option "--bogus"/)
  })

  it('errors on a local flag missing its value', () => {
    expect(() => parseLocalFlags(['--depth'], ['--depth'])).toThrowError(/missing its value/)
  })
})

describe('argvHasFlag', () => {
  it('finds a standalone boolean flag', () => {
    expect(argvHasFlag(['--verbose', 'doctor'], '--verbose')).toBe(true)
    expect(argvHasFlag(['doctor', '--verbose'], '--verbose')).toBe(true)
    expect(argvHasFlag(['doctor'], '--verbose')).toBe(false)
  })

  it('ignores a token that is only another flag\'s value', () => {
    expect(argvHasFlag(['--format', '--verbose'], '--verbose')).toBe(false)
  })
})

describe('globalFlagsHint', () => {
  it('lists every global flag', () => {
    expect(globalFlagsHint()).toContain('--format')
    expect(globalFlagsHint()).toContain('--bundle')
    expect(globalFlagsHint()).toContain('--limit')
  })
})
