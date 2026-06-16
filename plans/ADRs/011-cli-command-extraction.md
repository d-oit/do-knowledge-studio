# ADR 011: CLI Command Module Extraction

## Status
PROPOSED (2026-06-16) — Implementation tracked in `plans/040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md`

## Context
`cli/index.ts` is a monolithic Commander.js program that currently contains:
- `init`, `sync` (URL + directory), `export <format>`, `import <format>`, `migrate`, `rollback`, `status` — all in one file
- Already 200+ LOC and growing
- PR #309 promised 7 separate command files under `cli/commands/` but they were never created in `main`
- Issue #289 asks for headless `export` and `import` commands, which add more code to the same file
- AGENTS.md HARD RULE: **Max 500 LOC per source file** (this file is on track to violate that within 2 more features)

The same commands are also testable in isolation if extracted — currently there are zero CLI command tests in `cli/__tests__/`.

## Decision
We will extract each CLI command into its own file under `cli/commands/`:

```
cli/
├── index.ts          # entry point: registers all commands
├── db.ts             # initDb() helper (unchanged)
└── commands/
    ├── claim.ts      # `claim list|add|delete`
    ├── db.ts         # `db init|migrate|rollback|status`
    ├── entity.ts     # `entity list|get|create|delete`
    ├── export.ts     # `export <md|json|pdf|docx> [path]`
    ├── link.ts       # `link list|add|delete`
    ├── note.ts       # `note list|get|create`
    └── search.ts     # `search <query>`
```

### Each command module exports a single function

```ts
// cli/commands/export.ts
import { Command } from 'commander';
import type { Database } from 'better-sqlite3';

export interface CommandContext {
  db: Database;
  outputDir: string;
}

export function registerExportCommand(program: Command, ctx: CommandContext): void {
  const cmd = program
    .command('export <format>')
    .description('Export studio state to <md|json|pdf|docx>')
    .option('-o, --output <dir>', 'output directory', './export')
    .action(async (format: string, opts) => { /* ... */ });
}
```

### Why one file per command
- Each fits in < 200 LOC — well under the 500 limit
- Easy to unit-test in isolation: `registerExportCommand(new Command(), mockCtx)`
- Clear ownership: PRs that touch `claim` don't touch `export`
- Mirrors `src/features/*` boundary style

### Why `registerXxxCommand(program, ctx)` pattern
- Avoids global state
- The DB is injected — testable without `initDb()`
- Matches Commander.js community patterns

### Why keep `index.ts` as the entry
- One entry point for `pnpm run cli --`
- Other tools (e.g., `scripts/`) can import the whole program
- Avoids circular dependency between commands

## Alternatives Considered
- **Keep monolithic `index.ts`**: Violates 500 LOC rule within 1-2 features
- **Use a CLI framework (oclif, yargs)**: Overkill for 7 commands; adds a dependency
- **Auto-generate from subdirs**: Magic > explicitness; harder to debug
- **One `commands.ts` file with all of them**: Just moves the LOC violation, doesn't fix it

## Consequences

### Positive
- Each command testable in < 100 LOC test file
- New commands (e.g., `tag`, `graph`) are a 1-file PR
- Matches PR #309's promised structure (closes the gap that caused its CI failure)
- Scales to 20+ commands without touching `index.ts`

### Negative
- 7 new files to maintain
- Boilerplate `registerXxxCommand` pattern repeated (could DRY later if it becomes painful)
- Slight indirection cost when reading the program

## Implementation Plan
See `plans/040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md`, actions C1–C4.

### Refactor strategy
1. Create `cli/commands/` directory
2. Move each command block from `index.ts` to its own file
3. Replace inline blocks with `registerXxxCommand(program, ctx)` calls
4. Add `cli/__tests__/commands.test.ts` covering register + dispatch
5. Verify `pnpm run cli -- --help` shows all subcommands

## Files Affected
- **NEW** `cli/commands/{claim,db,entity,export,link,note,search}.ts` (7 files)
- `cli/index.ts` — slimmed to < 150 LOC
- **NEW** `cli/__tests__/commands.test.ts` — unit tests

## Verification
- `pnpm run cli -- --help` lists all 7+ subcommands
- `wc -l cli/index.ts` returns < 150
- `pnpm run cli -- export json -o /tmp/out.json` produces valid v1.0 export
- `pnpm run test` includes new CLI tests
- `find cli/commands -name "*.ts" | xargs wc -l` shows all < 200
