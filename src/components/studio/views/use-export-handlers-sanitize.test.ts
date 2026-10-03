import { describe, it, expect } from 'vitest'
import { sanitizeZipPath } from './use-export-handlers'

// Standalone suite for the pure sanitizer (#899). Kept out of
// use-export-handlers.test.ts, which was already over the 500-line ceiling
// (AGENTS.md: refactor before extending oversized files) — the hook suite
// there stays byte-identical to its pre-#899 state.
describe('sanitizeZipPath', () => {
  it('allows safe relative paths', () => {
    expect(sanitizeZipPath('concepts/foo.md')).toBe('concepts/foo.md')
    expect(sanitizeZipPath('okf-bundle/concepts/foo.md')).toBe('concepts/foo.md')
    expect(sanitizeZipPath('index.md')).toBe('index.md')
    expect(sanitizeZipPath('okf-bundle/index.md')).toBe('index.md')
  })

  it('normalizes backslashes to slashes', () => {
    expect(sanitizeZipPath('concepts\\foo.md')).toBe('concepts/foo.md')
    expect(sanitizeZipPath('okf-bundle\\concepts\\foo.md')).toBe('concepts/foo.md')
  })

  it('blocks path traversal via .. or . segments', () => {
    expect(sanitizeZipPath('../etc/passwd')).toBeNull()
    expect(sanitizeZipPath('../../secret.md')).toBeNull()
    expect(sanitizeZipPath('concepts/../secret.md')).toBeNull()
    expect(sanitizeZipPath('concepts/./foo.md')).toBeNull()
    expect(sanitizeZipPath('..\\..\\win.ini')).toBeNull()
  })

  it('returns null for empty or invalid paths', () => {
    expect(sanitizeZipPath('')).toBeNull()
    expect(sanitizeZipPath('/')).toBeNull()
    expect(sanitizeZipPath('okf-bundle/')).toBeNull()
    expect(sanitizeZipPath(null as unknown as string)).toBeNull()
  })

  it('documents the root-normalizing behavior: leading slashes collapse, nothing is rejected', () => {
    // The keys feed parseOkfBundle as plain strings — today no filesystem
    // write consumes them, so nothing is rejected at this layer. Revisit if a
    // filesystem consumer appears (see plans/162).
    expect(sanitizeZipPath('//etc/passwd')).toBe('etc/passwd')
    expect(sanitizeZipPath('/etc/passwd')).toBe('etc/passwd')
  })

  it('preserves drive-rooted names verbatim — the §2 contract is enforced downstream (#903)', () => {
    // Layered validation: the sanitizer's contract is Zip Slip only (traversal
    // outside the extraction root), so it preserves the string verbatim — the
    // id is data, not a path, and nothing here writes to disk. The
    // bundle-relative contract (okf/types.ts §2) is enforced by
    // parseOkfBundle, which since #903 rejects drive-rooted, absolute, and
    // root-backslash names as a §2 error before any entity is built — so a
    // drive-rooted entry can no longer mint ids like "C:/Windows/evil".
    expect(sanitizeZipPath('C:/Windows/evil.md')).toBe('C:/Windows/evil.md')
  })
})
