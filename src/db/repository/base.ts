import { z } from 'zod';
import { getDb, SQLiteDB } from '../client';
import { logger } from '../../lib/logger';

export class RepositoryBase {
  protected get db(): SQLiteDB {
    return getDb();
  }

  /** Execute raw SQL. Use execRows() for queries that return rows. */
  async exec(options: Parameters<SQLiteDB['exec']>[0]): Promise<unknown> {
    return this.db.exec(options);
  }

  /** Execute SQL and parse the result as an array of unknown rows via Zod. */
  async execRows(options: Parameters<SQLiteDB['exec']>[0]): Promise<unknown[]> {
    const result = await this.db.exec(options);
    return z.array(z.unknown()).parse(result);
  }

  async transaction(statements: Parameters<SQLiteDB['transaction']>[0]): Promise<unknown> {
    return this.db.transaction(statements);
  }

  public parseMetadata<T extends z.ZodType<unknown>>(schema: T, row: unknown): z.infer<T> {
    const r = { ...(row as Record<string, unknown>) };
    if (typeof r.metadata === 'string') {
      try {
        r.metadata = JSON.parse(r.metadata) as Record<string, unknown>;
      } catch (err) {
        logger.debug('Failed to parse metadata JSON, defaulting to empty object', { error: err instanceof Error ? err.message : String(err) });
        r.metadata = {};
      }
    }
    // Handle null/missing optional fields for Zod
    if (r.description === null) delete r.description;
    if (r.metadata === null) r.metadata = {};
    if (r.evidence === null) delete r.evidence;
    if (r.source === null) delete r.source;

    return schema.parse(r);
  }
}
