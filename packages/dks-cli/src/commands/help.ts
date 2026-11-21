/**
 * `dks help` / `--help` — the flag/command inventory is defined once here
 * and rendered as both text and JSON.
 */

export interface CommandDoc {
  name: string
  summary: string
}

export interface FlagDoc {
  flag: string
  description: string
}

export interface HelpData {
  usage: string[]
  commands: CommandDoc[]
  flags: FlagDoc[]
  notes: string[]
}

export const COMMAND_DOCS: readonly CommandDoc[] = [
  { name: 'help', summary: 'show this help (dks help [command] · dks --help)' },
  { name: 'version', summary: 'print { version, name, node }' },
  { name: 'doctor', summary: 'corpus presence + integrity, okf_version, counts, engine health' },
  { name: 'search', summary: 'dks search <query...> — BM25 retrieval over entities and claims' },
  { name: 'entity', summary: 'dks entity <id> — one entity with claims and relations' },
  { name: 'claims', summary: 'dks claims <entityId> — the entity\'s claims' },
  { name: 'aliases', summary: 'dks aliases <id> — the entity\'s aliases' },
  { name: 'relations', summary: 'dks relations <id> — related ids with resolved names' },
  { name: 'graph', summary: 'dks graph neighbors <id> [--depth n<=3] | path <from> <to> | stats' },
  { name: 'index', summary: 'list bundle entity ids + names (paginated by --limit)' },
  { name: 'backup', summary: 'dks backup verify <archive|--passphrase-env VAR> — verify a .dksb archive' },
  { name: 'skills', summary: 'dks skills list | validate [name] | test — .agents/skills frontmatter checks' },
  { name: 'export', summary: 'print the bundle (text → markdown, --format json → bundle JSON)' },
]

export const FLAG_DOCS: readonly FlagDoc[] = [
  { flag: '--format <json|text>', description: 'output envelope as JSON (every command honors it) or human text' },
  { flag: '--quiet', description: 'suppress stdout on success; failures still report' },
  { flag: '--no-color', description: 'accepted for pipeline parity; output is always plain' },
  { flag: '--limit <n>', description: 'result cap for search/graph/index (default 20, allowed 1–200)' },
  { flag: '--bundle <path>', description: 'OKF bundle directory or .zip (default ./knowledge or $DKS_BUNDLE)' },
]

const HELP_NOTES: readonly string[] = [
  'read-only: the CLI never writes to the bundle it inspects',
  '"-" in a path placeholder reads stdin (e.g. backup verify -)',
  'exit codes: 0 ok · 2 usage · 3 not-found · 4 conflict · 5 io · 6 permission · 7 internal',
]

const USAGE_LINES: readonly string[] = [
  'dks [global flags] <command> [args] [global flags]',
  'dks help [command] · dks --help · dks version',
]

const renderDocs = (): string => {
  const commands = COMMAND_DOCS.map((doc) => `  ${doc.name.padEnd(10)} ${doc.summary}`)
  const flags = FLAG_DOCS.map((doc) => `  ${doc.flag.padEnd(22)} ${doc.description}`)
  return [
    'dks — read-only OKF bundle operator CLI',
    '',
    'usage:',
    ...USAGE_LINES.map((line) => `  ${line}`),
    '',
    'commands:',
    ...commands,
    '',
    'global flags:',
    ...flags,
    '',
    'notes:',
    ...HELP_NOTES.map((note) => `  · ${note}`),
  ].join('\n')
}

/** The single help payload; text mode prints this verbatim. */
export const helpData = (): HelpData => ({
  usage: [...USAGE_LINES],
  commands: COMMAND_DOCS.map((doc) => ({ ...doc })),
  flags: FLAG_DOCS.map((doc) => ({ ...doc })),
  notes: [...HELP_NOTES],
})

export const HELP_TEXT = renderDocs()
