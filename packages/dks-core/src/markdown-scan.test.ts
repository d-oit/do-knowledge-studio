/**
 * Differential tests for the linear scanners (`markdown-scan.ts`).
 *
 * The scanners replaced the global regexes that CodeQL flagged as polynomial
 * on uncontrolled input (`[[[[`/`[](`/`\n# Claims\n` runs). The reference
 * regexes below are the exact patterns those scanners replaced; every test
 * asserts the scanner's output equals the regex's output on the same input,
 * so lint-adjacent refactors cannot silently diverge (LESSON-041's spirit:
 * the equivalence is checkable, not claimed).
 */
import { describe, expect, it } from 'vitest'
import {
  findMachineSection,
  scanRelativeLinks,
  scanWikilinks,
} from './markdown-scan.js'

/** Reference pattern replaced by {@link scanRelativeLinks}. */
const REF_RELATIVE_LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g
/** Reference pattern replaced by {@link scanWikilinks} (exact source bytes). */
const REF_WIKILINK = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g
/** Reference anchored section pattern replaced by findMachineSection(.., true). */
const refStripSection = (title: string) =>
  new RegExp(`(?:^|\\n)# ${title}\\n[\\s\\S]*?(?=\\n# |$)`)
/** Reference unanchored section pattern replaced by findMachineSection(.., false). */
const refUnanchoredSection = (title: string) =>
  new RegExp(`# ${title}\\n([\\s\\S]*?)(?:\\n# |$)`)

/** Collects the reference regex's matches (group captures + offsets). */
const referenceLinks = (body: string): Array<{ start: number; end: number; text: string; target: string }> => {
  const out: Array<{ start: number; end: number; text: string; target: string }> = []
  REF_RELATIVE_LINK.lastIndex = 0
  for (let m = REF_RELATIVE_LINK.exec(body); m !== null; m = REF_RELATIVE_LINK.exec(body)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[1] ?? '', target: m[2] ?? '' })
  }
  return out
}

/** Collects the reference wikilink regex's matches. */
const referenceWikilinks = (body: string): Array<{ start: number; end: number; name: string; display?: string }> => {
  const out: Array<{ start: number; end: number; name: string; display?: string }> = []
  REF_WIKILINK.lastIndex = 0
  for (let m = REF_WIKILINK.exec(body); m !== null; m = REF_WIKILINK.exec(body)) {
    const name = m[1] ?? ''
    const display = m[2]
    out.push(display === undefined
      ? { start: m.index, end: m.index + m[0].length, name }
      : { start: m.index, end: m.index + m[0].length, name, display })
  }
  return out
}

/** Applies the reference strip replacement chain. */
const referenceStrip = (body: string): string =>
  body
    .replace(refStripSection('Claims'), '')
    .replace(refStripSection('Related'), '')
    .trim()

/** Applies the reference unanchored-section link extraction. */
const referenceRelatedIds = (body: string): string[] => {
  const section = refUnanchoredSection('Related').exec(body)
  const block = section?.[1] ?? ''
  return Array.from(block.matchAll(REF_RELATIVE_LINK))
    .map((m) => (m[2] ?? '').replace(/^\/+/, '').replace(/\.md$/, ''))
    .filter((t) => t !== '')
}

/**
 * Deterministic generator: seeded LCG over an alphabet tuned to the link
 * grammar (brackets, pipes, parens, newlines, headings) so adversarial
 * near-miss sequences dominate the corpus.
 */
const ALPHABET = ['[', ']', '(', ')', '[[', ']]', '|', '\n', '#', ' ', 'a', '.md', '`', '\\', ':', '\t', '# Claims\n', '\n# Related\n', '![', '](x', '](', 'x)', '# Related\n']

const makeGenerator = (seed: number): (() => string) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    const length = (state >>> 16) % 40
    let out = ''
    for (let i = 0; i < length; i += 1) {
      state = (state * 1664525 + 1013904223) >>> 0
      out += ALPHABET[(state >>> 16) % ALPHABET.length]
    }
    return out
  }
}

describe('scanRelativeLinks matches the reference regex', () => {
  it('matches crafted edge cases exactly', () => {
    const cases = [
      '',
      '[',
      '[]',
      '[](',
      '[]()',
      `[[[[[[[[[[${'['.repeat(500)}`,
      `[text](${'x'.repeat(300)} nope`,
      `${'[](!'.repeat(200)}`,
      `${'[]('.repeat(200)}`,
      `${'[['.repeat(200)}`,
      '![image](pic.png) and [real](t.md)',
      '[a[b](c)',
      '[a](b)c](d)',
      '[multi\nline](target.md#frag)',
      '[a](https://scheme.example/x)',
      '[ spaced ]( tar get )',
      '[a](\ttabbed)',
      '[a](b)c)(d)',
      '[ähnlich](Ü correlates)',
      `[a](${'['.repeat(100)})`,
      '[[]] [[real]] [[with|display]] [[a||b]] [[|]] [[x|',
    ]
    for (const body of cases) {
      const actual = scanRelativeLinks(body).map((s) => ({ start: s.start, end: s.end, text: s.text, target: s.rawTarget }))
      expect(actual, JSON.stringify(body)).toEqual(referenceLinks(body))
    }
  })

  it('matches the reference regex on a deterministic adversarial corpus', () => {
    const next = makeGenerator(20261118)
    for (let i = 0; i < 500; i += 1) {
      const body = next()
      const actual = scanRelativeLinks(body).map((s) => ({ start: s.start, end: s.end, text: s.text, target: s.rawTarget }))
      expect(actual, `case ${i}: ${JSON.stringify(body)}`).toEqual(referenceLinks(body))
    }
  })
})

describe('scanWikilinks matches the reference regex', () => {
  it('matches crafted edge cases exactly', () => {
    const cases = [
      '',
      '[[',
      '[[]]',
      '[[|]]',
      '[[a]]',
      '[[a|b]]',
      '[[a||b]]',
      '[[a|]]',
      '[[|b]]',
      `${'[['.repeat(300)}`,
      `${'[[[[]]]'.repeat(120)}`,
      `[[${'a'.repeat(400)}|${'b'.repeat(400)}]]`,
      '[[a\\b]] [[c[d]] [[e]f]]',
      '[[Name|display | pipes]] then [[Next]]',
      'text [[Broken|and [[Nested]] done',
    ]
    for (const body of cases) {
      const actual = scanWikilinks(body).map((s) => ({ start: s.start, end: s.end, name: s.name, display: s.display }))
      expect(actual, JSON.stringify(body)).toEqual(referenceWikilinks(body))
    }
  })

  it('matches the reference regex on a deterministic adversarial corpus', () => {
    const next = makeGenerator(1129)
    for (let i = 0; i < 500; i += 1) {
      const body = next()
      const actual = scanWikilinks(body).map((s) => ({ start: s.start, end: s.end, name: s.name, display: s.display }))
      expect(actual, `case ${i}: ${JSON.stringify(body)}`).toEqual(referenceWikilinks(body))
    }
  })
})

describe('findMachineSection matches the reference strip/related regexes', () => {
  const stripWithScanners = (body: string): string => {
    const strip = (text: string, title: string): string => {
      const section = findMachineSection(text, title, true)
      return section === null ? text : text.slice(0, section.start) + text.slice(section.end)
    }
    return strip(strip(body, 'Claims'), 'Related').trim()
  }

  const relatedIdsWithScanner = (body: string): string[] => {
    const section = findMachineSection(body, 'Related', false)
    if (section === null) return []
    return scanRelativeLinks(section.content)
      .map((s) => s.rawTarget.replace(/^\/+/, '').replace(/\.md$/, ''))
      .filter((t) => t !== '')
  }

  it('strips machine sections exactly like the reference regex chain', () => {
    const cases = [
      '',
      '# Claims\nnothing',
      'x\n# Claims\nA\n# Related\nB\n# Tail\nC',
      '# Claims\nA\n## Claims\nnested\n# Related\nB',
      'prose only, no sections',
      '\n# Claims\n\n# Related\n[X](/Y.md)\n# Tail\n',
      `${'# Claims\nA\n'.repeat(50)}done`,
      'Weird\n# Claims\ntext\n#! not heading\nmore',
      '# Claims\nA\n#',            // unterminated next-heading marker
      '# Claims\nA\n# Claims\nB',  // repeated heading, lazy stop
      'trailing # Claims\n',       // heading + nothing
    ]
    for (const body of cases) {
      expect(stripWithScanners(body), JSON.stringify(body)).toEqual(referenceStrip(body))
    }
  })

  it('extracts related ids exactly like the reference regex path', () => {
    const cases = [
      '',
      '# Claims\nA',
      'xx# Related\n[One](/a.md) <!img.png> [Two](b/c.md#f) [dup](/a.md)',
      '# Claims\n[not related](x.md)\n# Related\n[Y](y.MD)',
      '# Related\n(no links here)',
      `# Related\n${'[a](x.md)'.repeat(100)}`,
      'middle# Related\n[Z](z.md)',
    ]
    for (const body of cases) {
      expect(relatedIdsWithScanner(body), JSON.stringify(body)).toEqual(referenceRelatedIds(body))
    }
  })

  it('both stay equivalent across the deterministic adversarial corpus', () => {
    const next = makeGenerator(777)
    for (let i = 0; i < 500; i += 1) {
      const body = next()
      expect(stripWithScanners(body), `strip ${i}: ${JSON.stringify(body)}`).toEqual(referenceStrip(body))
      expect(relatedIdsWithScanner(body), `ids ${i}: ${JSON.stringify(body)}`).toEqual(referenceRelatedIds(body))
    }
  })
})

describe('linear-time behavior (regression guard for the ReDoS findings)', () => {
  it('scans adversarial bracket bombs far below quadratic time', () => {
    // 40k of the worst-case input for the old patterns; a quadratic scan of
    // this is ~1.6e9 class transitions and visibly stalls; the scanners must
    // return in milliseconds.
    const bombs = [
      '['.repeat(40_000),
      `[](${'!'.repeat(40_000)}`,
      `[[${'x'.repeat(40_000)}`,
      `${'# Claims\nY\n'.repeat(4_000)}`,
    ]
    const started = Date.now()
    for (const bomb of bombs) {
      scanRelativeLinks(bomb)
      scanWikilinks(bomb)
      findMachineSection(bomb, 'Claims', true)
      findMachineSection(bomb, 'Related', false)
    }
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(2_000)
  })
})
