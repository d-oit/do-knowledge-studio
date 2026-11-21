import { describe, expect, it } from 'vitest'
import {
  EXIT_CONFLICT,
  EXIT_INTERNAL,
  EXIT_IO,
  EXIT_NOT_FOUND,
  EXIT_OK,
  EXIT_PERMISSION,
  EXIT_USAGE,
} from './exit-codes.js'

describe('exit codes (#1171)', () => {
  it('maps success to 0', () => {
    expect(EXIT_OK).toBe(0)
  })

  it('keeps usage at 2', () => {
    expect(EXIT_USAGE).toBe(2)
  })

  it('keeps not-found at 3', () => {
    expect(EXIT_NOT_FOUND).toBe(3)
  })

  it('keeps conflict at 4', () => {
    expect(EXIT_CONFLICT).toBe(4)
  })

  it('keeps io at 5', () => {
    expect(EXIT_IO).toBe(5)
  })

  it('keeps permission at 6', () => {
    expect(EXIT_PERMISSION).toBe(6)
  })

  it('keeps internal at 7', () => {
    expect(EXIT_INTERNAL).toBe(7)
  })

  it('never uses exit code 1 (reserved for unrelated tools)', () => {
    const all = [EXIT_OK, EXIT_USAGE, EXIT_NOT_FOUND, EXIT_CONFLICT, EXIT_IO, EXIT_PERMISSION, EXIT_INTERNAL]
    expect(all).not.toContain(1)
    expect(new Set(all).size).toBe(all.length)
  })
})
