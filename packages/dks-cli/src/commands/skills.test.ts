import { describe, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AGENTS_SUBDIR, SKILL_DESCRIPTION_MAX_CHARS, SKILLS_DIRNAME, SKILL_MD_NAME, SKILL_CHECKS, resolveSkillsDir, skillsData, skillsListData, skillsValidateData } from './skills.js'
import { nodeFsPort } from '../fs-port.js'
import { writeSkill, withTempDir } from '../fixtures.test.helpers.js'
import { CliError } from '../errors.js'

/** Captures the CliError code thrown synchronously by `run`. */
const errorCodeOf = (run: () => unknown): string => {
  try {
    run()
    return 'none'
  } catch (err) {
    if (err instanceof CliError) return err.code
    throw err
  }
}

const overlongDescription = 'x'.repeat(SKILL_DESCRIPTION_MAX_CHARS + 1)

describe('resolveSkillsDir', () => {
  it('resolves <bundle>/.agents/skills and trims trailing slashes', () => {
    expect(resolveSkillsDir('/repo/knowledge/')).toBe(`/repo/knowledge/${AGENTS_SUBDIR}/${SKILLS_DIRNAME}`)
  })
})

describe('skillsListData', () => {
  it('lists skills with parsed descriptions', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample')
      const data = skillsListData(nodeFsPort, dir)
      expect(data.skillsDir).toBe(`${dir}/${AGENTS_SUBDIR}/${SKILLS_DIRNAME}`)
      expect(data.skills).toEqual([{ name: 'sample', hasSkillMd: true, description: 'Sample skill for tests' }])
    })
  })

  it('lists directories without SKILL.md as lacking one', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample')
      await mkdir(join(dir, '.agents', 'skills', 'bare'), { recursive: true })
      const data = skillsListData(nodeFsPort, dir)
      expect(data.skills.map((skill) => `${skill.name}:${skill.hasSkillMd}`)).toEqual(['bare:false', 'sample:true'])
    })
  })

  it('throws not_found when the skills directory is absent', async () => {
    await withTempDir(async (dir) => {
      expect(errorCodeOf(() => skillsListData(nodeFsPort, dir))).toBe('not_found')
    })
  })
})

describe('skillsValidateData — healthy', () => {
  it('passes a compliant skill', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample')
      const data = skillsValidateData(nodeFsPort, dir, undefined)
      expect(data.failed).toBe(0)
      expect(data.healthy).toBe(1)
      expect(data.checked).toBe(1)
      expect(data.results.every((report) => report.findings.length === 0)).toBe(true)
    })
  })

  it('validates a single named skill', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'other', { frontmatter: 'name: other\ndescription: other skill\n', body: 'nothing.\n' })
      const data = skillsValidateData(nodeFsPort, dir, 'other')
      expect(data.checked).toBe(1)
      expect(data.failed).toBe(0)
    })
  })

  it('throws not_found for an unknown skill name', async () => {
    await withTempDir(async (dir) => {
      expect(errorCodeOf(() => skillsValidateData(nodeFsPort, dir, 'ghost'))).toBe('not_found')
    })
  })

  it('records the check registry', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample')
      const data = skillsValidateData(nodeFsPort, dir, undefined)
      expect(data.checks).toEqual(SKILL_CHECKS)
    })
  })
})

describe('skillsValidateData — findings', () => {
  it('flags frontmatter name/directory mismatch', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', { frontmatter: 'name: other\ndescription: Sample skill for tests\n', body: 'nothing.\n' })
      const data = skillsValidateData(nodeFsPort, dir, 'sample')
      expect(data.failed).toBe(1)
      expect(data.results.at(0)?.findings).toContain('name mismatch: frontmatter "other" != directory "sample"')
    })
  })

  it('flags missing required fields', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', { frontmatter: 'category: test\n', body: 'nothing.\n' })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings).toContain('missing required field "name"')
      expect(findings).toContain('missing required field "description"')
    })
  })

  it('flags descriptions over the 300-char budget', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', { frontmatter: `name: sample\ndescription: ${overlongDescription}\n`, body: 'nothing.\n' })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings.some((finding) => finding.includes('description is'))).toBe(true)
    })
  })

  it('flags block-scalar descriptions', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', {
        skillMd: '---\nname: sample\ndescription: >\n  folded description\n---\n\nbody\n',
      })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings).toContain('description must be a single-line string, not a block scalar')
    })
  })

  it('flags dead references in the SKILL.md body', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', { body: 'see `references/gone.md` and `scripts/gone.sh`.\nnothing else.\n' })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings.some((finding) => finding.includes('dead reference "references/gone.md"'))).toBe(true)
      expect(findings.some((finding) => finding.includes('dead reference "scripts/gone.sh"'))).toBe(true)
    })
  })

  it('validates reference documents, not just SKILL.md', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', { body: 'See `references/guide.md` for details.\n' })
      const references = join(dir, '.agents', 'skills', 'sample', 'references')
      await mkdir(references, { recursive: true })
      await writeFile(join(references, 'guide.md'), 'Run scripts/missing.sh now.\n', 'utf8')
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings.some((finding) => finding.includes('references/guide.md: dead reference "scripts/missing.sh"'))).toBe(true)
    })
  })

  it('scans references mentioned in frontmatter', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', {
        skillMd: '---\nname: sample\ndescription: see references/gone.md for detail\n---\n\nBody long enough to pass the minimum.\n',
      })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings.some((finding) => finding.includes('dead reference "references/gone.md"'))).toBe(true)
    })
  })

  it('ignores non-path code tokens and prose dots', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', {
        body: 'Use `JSON.parse`, `user@gmail.com`, `site:docs.rs`, and `vi.fn().mockResolvedValue`. See `.md`.\n',
      })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings).toEqual([])
    })
  })

  it('resolves cross-skill references under the skills root', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', { body: 'see `other/references/guide.md` for detail.\n' })
      await writeSkill(dir, 'other')
      await mkdir(join(dir, '.agents', 'skills', 'other', 'references'), { recursive: true })
      await writeFile(join(dir, '.agents', 'skills', 'other', 'references', 'guide.md'), 'guide\n', 'utf8')
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings).toEqual([])
    })
  })

  it('skips references inside example fences', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', {
        body: '```bash example\nscripts/missing.sh --now\n```\n\nProse only after the example.\n',
      })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings).toEqual([])
    })
  })

  it('flags prefixed paths outside backticks', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample', { body: 'Run scripts/missing.sh before continuing.\n' })
      const findings = skillsValidateData(nodeFsPort, dir, 'sample').results.at(0)?.findings ?? []
      expect(findings.some((finding) => finding.includes('dead reference "scripts/missing.sh"'))).toBe(true)
    })
  })

  it('flags missing SKILL.md entirely', async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, '.agents', 'skills', 'hollow'), { recursive: true })
      const findings = skillsValidateData(nodeFsPort, dir, 'hollow').results.at(0)?.findings ?? []
      expect(findings).toEqual([`missing ${SKILL_MD_NAME}`])
    })
  })

  it('parity: every skill in this repository passes', () => {
    const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
    const report = skillsValidateData(nodeFsPort, repoRoot, undefined)
    expect({ failed: report.failed, results: report.results.filter((entry) => entry.findings.length > 0) })
      .toEqual({ failed: 0, results: [] })
  })
})

describe('skillsData dispatch', () => {
  it('dispatches list / validate / test', async () => {
    await withTempDir(async (dir) => {
      await writeSkill(dir, 'sample')
      expect('skills' in skillsData(['list'], nodeFsPort, dir)).toBe(true)
      const validated = skillsData(['validate'], nodeFsPort, dir)
      expect('results' in validated && validated.checked).toBe(1)
      const tested = skillsData(['test'], nodeFsPort, dir)
      expect('results' in tested && tested.failed).toBe(0)
    })
  })

  it('rejects a missing or unknown subcommand as usage', async () => {
    await withTempDir(async (dir) => {
      expect(errorCodeOf(() => skillsData([], nodeFsPort, dir))).toBe('usage')
      expect(errorCodeOf(() => skillsData(['chop'], nodeFsPort, dir))).toBe('usage')
    })
  })
})
