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

  it('does not validate the bundle-relative contract — drive-rooted names survive with a documented gap', () => {
    // KNOWN GAP, not endorsement: a drive-rooted entry survives as
    // "C:/Windows/evil.md"; buildEntity would derive the entity id
    // "C:/Windows/evil", violating the bundle-relative contract in
    // okf/types.ts. The sanitizer's contract is Zip Slip only (traversal to
    // outside the extraction root) — sanitizeZipPath never writes to disk and
    // the id is data, not a path. Rejection belongs in parseOkfBundle/§2
    // validation, tracked as a follow-up in plans/162.
    expect(sanitizeZipPath('C:/Windows/evil.md')).toBe('C:/Windows/evil.md')
  })
})
