/**
 * Shared types and helpers for CLI command modules.
 *
 * Each command in `cli/commands/*.ts` exports a `registerXxxCommand` function
 * that takes a Commander `Command` instance plus a `CommandContext` (db,
 * output directory, etc.) and attaches the subcommand. This avoids global
 * state and makes each command unit-testable in isolation.
 */
import type { Command } from 'commander';
import type { Database } from 'better-sqlite3';

export interface CommandContext {
  /** The open database instance. May be null for commands that don't need DB. */
  getDb(): Database | null;
  /** Output directory for file-producing commands. */
  outputDir: string;
}

export type CommandRegistrar = (program: Command, ctx: CommandContext) => void;
