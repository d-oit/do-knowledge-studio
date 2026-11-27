/**
 * `dks help` / `--help` — the flag/command inventory is defined once here
 * and rendered as both text and JSON. `dks help <command>` narrows the same
 * payload to one command's usage, access class and runnable examples.
 */

export type CommandAccess = 'read-only' | 'mutating'

export interface CommandDoc {
  name: string
  summary: string
  /** Operands and local flags, without the leading `dks`. */
  usage: string
  access: CommandAccess
  examples: readonly string[]
}

export interface FlagDoc {
  flag: string
  description: string
}

export interface HelpData {
  /** Set only for a focused `dks help <command>` page. */
  focused?: string
  usage: string[]
  commands: CommandDoc[]
  flags: FlagDoc[]
  notes: string[]
}

const READ_ONLY: CommandAccess = 'read-only'

export const COMMAND_DOCS: readonly CommandDoc[] = [
  {
    name: 'help',
    summary: 'show the inventory, or one command\'s usage and examples',
    usage: 'help [COMMAND]',
    access: READ_ONLY,
    examples: ['dks help', 'dks help search'],
  },
  {
    name: 'version',
    summary: 'print { version, name, node }',
    usage: 'version',
    access: READ_ONLY,
    examples: ['dks version', 'dks version --format json'],
  },
  {
    name: 'doctor',
    summary: 'corpus presence + integrity, okf_version, counts, engine health',
    usage: 'doctor',
    access: READ_ONLY,
    examples: ['dks doctor', 'dks doctor --bundle ./knowledge --format json'],
  },
  {
    name: 'search',
    summary: 'BM25 retrieval over entities and claims',
    usage: 'search QUERY...',
    access: READ_ONLY,
    examples: ['dks search knowledge graph', 'dks search "at-rest encryption" --limit 5 --format json'],
  },
  {
    name: 'entity',
    summary: 'one entity with claims and relations',
    usage: 'entity ID',
    access: READ_ONLY,
    examples: ['dks entity ENTITY_ID', 'dks entity ENTITY_ID --format json'],
  },
  {
    name: 'claims',
    summary: 'the entity\'s claims',
    usage: 'claims ENTITY_ID',
    access: READ_ONLY,
    examples: ['dks claims ENTITY_ID', 'dks claims ENTITY_ID --format json'],
  },
  {
    name: 'aliases',
    summary: 'the entity\'s aliases',
    usage: 'aliases ID',
    access: READ_ONLY,
    examples: ['dks aliases ENTITY_ID'],
  },
  {
    name: 'relations',
    summary: 'related ids with resolved names',
    usage: 'relations ID',
    access: READ_ONLY,
    examples: ['dks relations ENTITY_ID', 'dks relations ENTITY_ID --format json'],
  },
  {
    name: 'graph',
    summary: 'neighbors within a depth, shortest path, or census',
    usage: 'graph neighbors ID [--depth N<=3] | path FROM TO | stats',
    access: READ_ONLY,
    examples: [
      'dks graph neighbors ENTITY_ID --depth 2',
      'dks graph path FROM_ID TO_ID',
      'dks graph stats --format json',
    ],
  },
  {
    name: 'index',
    summary: 'list bundle entity ids + names (paginated by --limit)',
    usage: 'index',
    access: READ_ONLY,
    examples: ['dks index --limit 50', 'dks index --format json'],
  },
  {
    name: 'backup',
    summary: 'verify a .dksb archive',
    usage: 'backup verify ARCHIVE|--passphrase-env VAR',
    access: READ_ONLY,
    examples: [
      'dks backup verify ./backup.dksb',
      'cat backup.dksb | dks backup verify -',
      'dks backup verify ./backup.dksb --passphrase-env DKS_BACKUP_PASSPHRASE',
    ],
  },
  {
    name: 'skills',
    summary: '.agents/skills frontmatter and reference checks',
    usage: 'skills list | validate [name] | test',
    access: READ_ONLY,
    examples: ['dks skills list', 'dks skills validate', 'dks skills test --format json'],
  },
  {
    name: 'export',
    summary: 'print the bundle (text → markdown, --format json → bundle JSON)',
    usage: 'export',
    access: READ_ONLY,
    examples: ['dks export', 'dks export --format json'],
  },
]

export const FLAG_DOCS: readonly FlagDoc[] = [
  { flag: '--format JSON|TEXT', description: 'output envelope as JSON (every command honors it) or human text' },
  { flag: '--quiet', description: 'suppress stdout on success; failures still report' },
  { flag: '--verbose', description: 'one diagnostic line on stderr; stdout and JSON data are unchanged' },
  { flag: '--no-color', description: 'accepted for pipeline parity; output is always plain' },
  { flag: '--limit N', description: 'result cap for search/index (default 20, allowed 1–200)' },
  { flag: '--bundle PATH', description: 'OKF bundle directory or .zip (default ./knowledge or $DKS_BUNDLE)' },
]

const HELP_NOTES: readonly string[] = [
  'access: every command is read-only — no writes, imports, restores or other mutating operations',
  'the browser workspace (IndexedDB) is not reachable from Node — operate on an exported bundle',
  'in examples, ENTITY_ID, FROM_ID and TO_ID are placeholders: list real ids with dks index',
  '"-" in a path placeholder reads stdin (e.g. backup verify -)',
  'exit codes: 0 ok · 2 usage · 3 not-found · 4 conflict · 5 io · 6 permission · 7 internal',
]

const USAGE_LINES: readonly string[] = [
  'dks [global flags] COMMAND [args] [global flags]',
  'dks help [COMMAND] · dks --help · dks version',
]

const COMMAND_PAD = 10
const FLAG_PAD = 22

/** Human label for a command's access class. */
const accessLabel = (access: CommandAccess): string =>
  access === 'read-only' ? 'read-only — reads the bundle, never writes it' : 'mutating — changes stored state'

/** Renders the inventory, or a focused command page, as text. */
export const renderHelp = (data: HelpData): string => {
  const focused = data.focused === undefined ? undefined : data.commands.at(0)
  const lines = ['dks — read-only OKF bundle operator CLI', '', 'usage:', ...data.usage.map((line) => `  ${line}`)]
  if (focused === undefined) {
    lines.push('', 'commands:', ...data.commands.map((doc) => `  ${doc.name.padEnd(COMMAND_PAD)} ${doc.summary}`))
  } else {
    lines.push(
      '',
      `command ${focused.name}:`,
      `  ${focused.summary}`,
      `  access: ${accessLabel(focused.access)}`,
      '',
      'examples:',
      ...focused.examples.map((example) => `  ${example}`),
    )
  }
  lines.push(
    '',
    'global flags:',
    ...data.flags.map((doc) => `  ${doc.flag.padEnd(FLAG_PAD)} ${doc.description}`),
    '',
    'notes:',
    ...data.notes.map((note) => `  · ${note}`),
  )
  return lines.join('\n')
}

/** The help payload: the full inventory, or one focused command page. */
export const helpData = (target?: string): HelpData => {
  const doc = target === undefined ? undefined : COMMAND_DOCS.find((entry) => entry.name === target)
  return {
    ...(doc === undefined ? {} : { focused: doc.name }),
    usage: doc === undefined ? [...USAGE_LINES] : [`dks ${doc.usage} [global flags]`],
    commands: doc === undefined ? COMMAND_DOCS.map((entry) => ({ ...entry })) : [{ ...doc }],
    flags: FLAG_DOCS.map((entry) => ({ ...entry })),
    notes: [...HELP_NOTES],
  }
}

/** The full inventory as text; text mode prints this verbatim. */
export const HELP_TEXT = renderHelp(helpData())
