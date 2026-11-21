/**
 * `dks skills` — read-only validation of Portable Agent Skills frontmatter
 * under `<bundle>/.agents/skills`. Rules (mirroring the repo's
 * `scripts/agent-surface.py`): required `name`/`description`, name/dir
 * consistency, 300-char single-line description budget, and referenced
 * files that must exist. Reference extraction mirrors the repo's canonical
 * `scripts/agent-surface.py` scanner: prefixed path tokens only, example
 * fences skipped, and cross-skill references resolved under the skills root.
 */

import { isSafePath, parseFrontmatter, splitFrontmatter, type FmValue, type FsPort } from 'dks-core'
import { CliError } from '../errors.js'
import { decodeUtf8Strict } from '../fs-port.js'

export const AGENTS_SUBDIR = '.agents'
export const SKILLS_DIRNAME = 'skills'
export const SKILL_MD_NAME = 'SKILL.md'

export const SKILL_DESCRIPTION_MAX_CHARS = 300
export const MIN_SKILL_MD_CHARS = 50
/** Registry of the checks every skill is run through. */
export const SKILL_CHECKS = [
  'frontmatter',
  'required-fields',
  'name-match',
  'description-budget',
  'references-exist',
] as const
export const SKILL_CHECK_LABELS: Readonly<Record<(typeof SKILL_CHECKS)[number], string>> = {
  frontmatter: 'YAML frontmatter parses',
  'required-fields': 'name and description present',
  'name-match': 'frontmatter name equals directory name',
  'description-budget': 'description is a single-line string within 300 chars',
  'references-exist': 'referenced files resolve in the bundle or skill dir',
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
      `skills commands read [bundle]/${AGENTS_SUBDIR}/${SKILLS_DIRNAME}; point --bundle at a bundle root`,
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

/** CommonMark fence run; the info string follows the opening backticks. */
const FENCE_PATTERN = /^(`{3,})(.*)$/
/** A fence explicitly marked illustrative is skipped (canonical parity). */
const EXAMPLE_MARKER_PATTERN = /^\s*(?:#{1,6}\s+|(?:<!--|\/\/|--|;|%|"|')\s*)?example\b/i
/**
 * Path-shaped references only, mirroring `agent-surface.py`:
 * `scripts/…`, `agents-docs/…`, `references/…`, or `<skill>/…`.
 * Bare code identifiers (`JSON.parse`), emails, and prose dots do not match.
 */
const REFERENCE_TOKEN_PATTERN =
  /(?:^|[\s(["'`>$=*/])((?:[a-z0-9][a-z0-9-]*\/)?(?:scripts|agents-docs|references)\/[A-Za-z0-9_][A-Za-z0-9_./-]*)/g

/** Extracts references, skipping example fences and non-path tokens. */
const collectReferences = (body: string): string[] => {
  const refs: string[] = []
  let inFence = false
  let fenceIsExample = false
  let fenceSawContent = false
  let fenceLength = 0
  for (const line of body.split('\n')) {
    const stripped = line.trim()
    const fence = FENCE_PATTERN.exec(stripped)
    if (fence !== null && (!inFence || (fence[2] ?? '').trim().length === 0)) {
      const run = (fence[1] ?? '').length
      if (!inFence) {
        inFence = true
        fenceLength = run
        fenceIsExample = stripped.toLowerCase().includes('example')
        fenceSawContent = false
      } else if (run >= fenceLength) {
        inFence = false
        fenceIsExample = false
      }
      continue
    }
    if (inFence) {
      if (!fenceIsExample && !fenceSawContent && stripped.length > 0) {
        fenceSawContent = true
        if (EXAMPLE_MARKER_PATTERN.test(stripped)) fenceIsExample = true
      }
      if (fenceIsExample) continue
    }
    for (const match of line.matchAll(REFERENCE_TOKEN_PATTERN)) {
      const ref = (match[1] ?? '').replace(/[.,:;)]+$/, '')
      if (ref.endsWith('/') || ref.endsWith('.') || ref.endsWith(',')) continue
      const basename = ref.split('/').pop() ?? ''
      if (basename.length === 0 || basename.includes('*') || !basename.includes('.')) continue
      if (!refs.includes(ref)) refs.push(ref)
    }
  }
  return refs
}

/** Canonical resolution order for one reference. */
const referenceResolves = (
  port: FsPort,
  ref: string,
  skillName: string,
  skillsDir: string,
  bundleRoot: string,
  knownSkills: ReadonlySet<string>,
): boolean => {
  if (!isSafePath(ref)) return false
  const skillDir = `${skillsDir}/${skillName}`
  const first = ref.split('/').at(0) ?? ''
  if (knownSkills.has(first)) return pathExists(port, `${skillsDir}/${ref}`)
  if (ref.startsWith('scripts/')) {
    const sub = ref.slice('scripts/'.length)
    return pathExists(port, `${bundleRoot}/scripts/${sub}`) || pathExists(port, `${skillDir}/scripts/${sub}`)
  }
  if (ref.startsWith('references/')) return pathExists(port, `${skillDir}/${ref}`)
  return pathExists(port, `${bundleRoot}/${ref}`)
}

/** Every Markdown file under a skill, relative to the skill directory. */
const listMarkdownFiles = (port: FsPort, skillDir: string): string[] => {
  const files: string[] = []
  const walk = (current: string, prefix: string): void => {
    for (const entry of port.readDirEntries(current)) {
      if (entry.name.startsWith('.')) continue
      const relative = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory) {
        walk(`${current}/${entry.name}`, relative)
      } else if (entry.name.endsWith('.md')) {
        files.push(relative)
      }
    }
  }
  walk(skillDir, '')
  return files.sort()
}

/**
 * Canonical parity: scan every Markdown file in the skill, including
 * reference documents and frontmatter, not only SKILL.md's body.
 */
const checkReferences = (
  port: FsPort,
  skillDir: string,
  skillName: string,
  skillsDir: string,
  bundleRoot: string,
  knownSkills: ReadonlySet<string>,
  findings: string[],
): void => {
  for (const relative of listMarkdownFiles(port, skillDir)) {
    let text: string
    try {
      text = decodeUtf8Strict(port.readFileBytes(`${skillDir}/${relative}`))
    } catch {
      findings.push(`${relative}: could not be read as UTF-8`)
      continue
    }
    for (const ref of collectReferences(text)) {
      if (!referenceResolves(port, ref, skillName, skillsDir, bundleRoot, knownSkills)) {
        findings.push(`${relative}: dead reference "${ref}"`)
      }
    }
  }
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
  knownSkills: ReadonlySet<string>,
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

  checkReferences(port, skillDir, name, skillsDir, bundleRoot, knownSkills, findings)
  return { name, findings }
}

const validateAll = (
  port: FsPort,
  bundlePath: string,
  skillsDir: string,
  names: readonly string[],
  knownSkills: ReadonlySet<string>,
): SkillsData => {
  const results = names.map((name) => validateSkill(port, skillsDir, name, bundlePath, knownSkills))
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
  const allNames = skillsDirOrThrow(port, skillsDir)
  let names = allNames
  if (only !== undefined && !allNames.includes(only)) {
    throw new CliError('not_found', `unknown skill "${only}"`, `available: ${allNames.join(', ')}`)
  }
  if (only !== undefined) names = [only]
  return validateAll(port, bundlePath, skillsDir, names, new Set(allNames))
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
