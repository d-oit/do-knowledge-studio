/**
 * `dks skills` — read-only validation of Portable Agent Skills frontmatter
 * under `<bundle>/.agents/skills`. Rules (mirroring the repo's
 * `scripts/agent-surface.py`): required `name`/`description`, name/dir
 * consistency, 300-char single-line description budget, and referenced
 * files that must exist. Executability of referenced scripts is checked
 * through the FsPort contract with a shebang probe — the port exposes no
 * stat/mode API by design (LESSON-063: no extra `node:fs` surface).
 */

import { parseFrontmatter, splitFrontmatter, type FmValue, type FsPort } from 'dks-core'
import { CliError } from '../errors.js'
import { decodeUtf8Strict } from '../fs-port.js'

export const AGENTS_SUBDIR = '.agents'
export const SKILLS_DIRNAME = 'skills'
export const SKILL_MD_NAME = 'SKILL.md'

export const SKILL_DESCRIPTION_MAX_CHARS = 300
export const MIN_SKILL_MD_CHARS = 50
/** A `#!` first line is the port-visible proxy for an executable script. */
const SHEBANG = '#!'
/** Registry of the checks every skill is run through. */
export const SKILL_CHECKS = [
  'frontmatter',
  'required-fields',
  'name-match',
  'description-budget',
  'references-exist',
  'scripts-executable',
] as const
export const SKILL_CHECK_LABELS: Readonly<Record<(typeof SKILL_CHECKS)[number], string>> = {
  frontmatter: 'YAML frontmatter parses',
  'required-fields': 'name and description present',
  'name-match': 'frontmatter name equals directory name',
  'description-budget': 'description is a single-line string within 300 chars',
  'references-exist': 'referenced files resolve in the bundle or skill dir',
  'scripts-executable': 'referenced scripts carry a shebang',
}

export interface SkillReport {
  name: string
  findings: string[]
}

export interface SkillsListEntry {
  name: string
  hasSkillMd: boolean
  description?: string
}

export interface SkillsListData {
  skillsDir: string
  skills: SkillsListEntry[]
}

export interface SkillsData {
  skillsDir: string
  checked: number
  healthy: number
  failed: number
  results: SkillReport[]
  checks: readonly string[]
}

/** `<bundle>/.agents/skills`, normalized against trailing slashes. */
export const resolveSkillsDir = (bundlePath: string): string => {
  const root = bundlePath.replace(/\/+$/, '')
  return `${root}/${AGENTS_SUBDIR}/${SKILLS_DIRNAME}`
}

const skillsDirOrThrow = (port: FsPort, skillsDir: string): string[] => {
  if (!port.isDirectory(skillsDir)) {
    throw new CliError(
      'not_found',
      `no skills directory at "${skillsDir}"`,
      `skills commands read <bundle>/${AGENTS_SUBDIR}/${SKILLS_DIRNAME}; point --bundle at a bundle root`,
    )
  }
  const names = port.readDirEntries(skillsDir)
    .filter((entry) => entry.isDirectory)
    .map((entry) => entry.name)
  if (names.length === 0) {
    throw new CliError('not_found', `no skills under "${skillsDir}"`, 'skill folders should each contain a SKILL.md')
  }
  return names
}

const pathExists = (port: FsPort, path: string): boolean => {
  if (port.isDirectory(path)) return true
  try {
    port.readFileBytes(path)
    return true
  } catch {
    return false
  }
}

const startsWithShebang = (port: FsPort, path: string): boolean => {
  try {
    return decodeUtf8Strict(port.readFileBytes(path)).startsWith(SHEBANG)
  } catch {
    return false
  }
}

/** Backticked tokens that look like file references (globs/bare dirs skipped). */
const referencedFiles = (body: string): string[] => {
  const refs: string[] = []
  const pattern = /`([^`\n]+)`/g
  for (const match of body.matchAll(pattern)) {
    const token = (match.at(1) ?? '').replace(/[.,:;)\]]+$/, '')
    if (token.includes('*') || token.includes(' ') || token.endsWith('/')) continue
    const basename = token.split('/').pop() ?? ''
    if (!basename.includes('.')) continue
    if (!refs.includes(token)) refs.push(token)
  }
  return refs
}

/** Candidate paths for a reference: skill dir first, then bundle root. */
const referenceCandidates = (ref: string, skillName: string, skillsDir: string, bundleRoot: string): string[] => {
  const skillDir = `${skillsDir}/${skillName}`
  const first = ref.split('/').at(0) ?? ''
  if (first === skillName) return [`${skillsDir}/${ref}`]
  if (ref.startsWith('scripts/')) {
    return [`${skillDir}/${ref}`, `${bundleRoot}/${ref}`]
  }
  if (ref.startsWith('references/')) return [`${skillDir}/${ref}`]
  return [`${bundleRoot}/${ref}`]
}

const readSkillText = (port: FsPort, skillDir: string, findings: string[]): string | undefined => {
  let bytes: Uint8Array
  try {
    bytes = port.readFileBytes(`${skillDir}/${SKILL_MD_NAME}`)
  } catch {
    findings.push(`missing ${SKILL_MD_NAME}`)
    return undefined
  }
  try {
    return decodeUtf8Strict(bytes)
  } catch {
    findings.push(`${SKILL_MD_NAME} is not valid UTF-8`)
    return undefined
  }
}

export const validateSkill = (
  port: FsPort,
  skillsDir: string,
  name: string,
  bundleRoot: string,
): SkillReport => {
  const findings: string[] = []
  const skillDir = `${skillsDir}/${name}`
  const text = readSkillText(port, skillDir, findings)
  if (text === undefined) return { name, findings }

  if (Array.from(text).length < MIN_SKILL_MD_CHARS) {
    findings.push(`too short (${Array.from(text).length} chars; minimum ${MIN_SKILL_MD_CHARS})`)
  }
  const split = splitFrontmatter(text)
  const rawFrontmatter = split.frontmatter
  if (rawFrontmatter === null) {
    findings.push('missing YAML frontmatter')
    return { name, findings }
  }
  if (/^description:\s*[>|]/m.test(rawFrontmatter)) {
    findings.push('description must be a single-line string, not a block scalar')
  }
  const parsed = parseFrontmatter(rawFrontmatter)
  if (!parsed.ok) {
    findings.push(`frontmatter parse error: ${parsed.error}`)
    return { name, findings }
  }
  const fm: Record<string, FmValue> = parsed.data

  const skillName = typeof fm.name === 'string' ? fm.name : undefined
  if (skillName === undefined) {
    findings.push('missing required field "name"')
  } else if (skillName !== name) {
    findings.push(`name mismatch: frontmatter "${skillName}" != directory "${name}"`)
  }
  const description = typeof fm.description === 'string' ? fm.description : undefined
  if (description === undefined) {
    findings.push('missing required field "description"')
  } else if (description.length > SKILL_DESCRIPTION_MAX_CHARS) {
    findings.push(`description is ${description.length} chars (limit ${SKILL_DESCRIPTION_MAX_CHARS})`)
  }

  for (const ref of referencedFiles(split.body)) {
    const candidates = referenceCandidates(ref, name, skillsDir, bundleRoot)
    const resolved = candidates.find((candidate) => pathExists(port, candidate))
    if (resolved === undefined) {
      findings.push(`dead reference "${ref}"`)
      continue
    }
    if (ref.startsWith('scripts/') && !startsWithShebang(port, resolved)) {
      findings.push(`referenced script "${ref}" carries no shebang (executable requirement)`)
    }
  }
  return { name, findings }
}

const validateAll = (port: FsPort, bundlePath: string, skillsDir: string, names: readonly string[]): SkillsData => {
  const results = names.map((name) => validateSkill(port, skillsDir, name, bundlePath))
  const failed = results.filter((report) => report.findings.length > 0).length
  return {
    skillsDir,
    checked: results.length,
    healthy: results.length - failed,
    failed,
    results,
    checks: SKILL_CHECKS,
  }
}

/** `skills list` — inventory incl. parseable description, no validation. */
export const skillsListData = (port: FsPort, bundlePath: string): SkillsListData => {
  const skillsDir = resolveSkillsDir(bundlePath)
  const names = skillsDirOrThrow(port, skillsDir)
  const skills = names.map((name) => {
    let hasSkillMd = false
    let description: string | undefined
    try {
      const text = decodeUtf8Strict(port.readFileBytes(`${skillsDir}/${name}/${SKILL_MD_NAME}`))
      hasSkillMd = true
      const split = splitFrontmatter(text)
      const parsed = split.frontmatter === null ? undefined : parseFrontmatter(split.frontmatter)
      const value = parsed?.ok === true && typeof parsed.data.description === 'string'
        ? parsed.data.description
        : undefined
      if (value !== undefined) description = value
    } catch {
      // Missing or unreadable SKILL.md: show up as hasSkillMd false.
    }
    const entry: SkillsListEntry = { name, hasSkillMd }
    if (description !== undefined) entry.description = description
    return entry
  })
  return { skillsDir, skills }
}

/** `skills validate [name]` / `skills test` — full validation report. */
export const skillsValidateData = (
  port: FsPort,
  bundlePath: string,
  only: string | undefined,
): SkillsData => {
  const skillsDir = resolveSkillsDir(bundlePath)
  let names = skillsDirOrThrow(port, skillsDir)
  if (only !== undefined && !names.includes(only)) {
    throw new CliError('not_found', `unknown skill "${only}"`, `available: ${names.join(', ')}`)
  }
  if (only !== undefined) names = [only]
  return validateAll(port, bundlePath, skillsDir, names)
}

/** `dks skills ...` subcommand dispatch. */
export type SkillsCommandData = SkillsListData | SkillsData

export const skillsData = (args: readonly string[], port: FsPort, bundlePath: string): SkillsCommandData => {
  const sub = args.at(0)
  switch (sub) {
    case 'list':
      return skillsListData(port, bundlePath)
    case 'validate':
      return skillsValidateData(port, bundlePath, args.at(1))
    case 'test':
      return skillsValidateData(port, bundlePath, undefined)
    case undefined:
      throw new CliError('usage', 'skills needs a subcommand', 'dks skills list | validate [name] | test')
    default:
      throw new CliError('usage', `unknown skills subcommand "${sub}"`, 'known subcommands: list | validate | test')
  }
}
