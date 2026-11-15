import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const COMPONENTS_ROOT = join(__dirname)
const TOAST_LITERAL_PATTERN = /toast\.(error|success|info|warning)\(\s*['`]/

const collectSources = (dir: string, out: string[]): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      collectSources(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('no hardcoded toast literals in components', () => {
  it('routes every toast title through the i18n message map', () => {
    const offenders: string[] = []
    for (const file of collectSources(COMPONENTS_ROOT, [])) {
      const text = readFileSync(file, 'utf8')
      if (TOAST_LITERAL_PATTERN.test(text)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})
