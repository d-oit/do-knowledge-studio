import { z } from 'zod';
import { getDb, SQLiteDB } from '../client';

export class RepositoryBase {
  protected get db(): SQLiteDB {
    return getDb();
  }

  async exec(options: Parameters<SQLiteDB['exec']>[0]): Promise<unknown> {
    return this.db.exec(options);
  }

  async transaction(statements: Parameters<SQLiteDB['transaction']>[0]): Promise<unknown> {
    return this.db.transaction(statements);
  }

  private normalizeFields(row: Record<string, unknown>): void {
    const fieldsToNormalize = ['description', 'evidence', 'source', 'metadata'] as const;
    for (const field of fieldsToNormalize) {
      if (row[field] === null) {
        row[field] = field === 'metadata' ? {} : undefined;
      }
    }
  }

  public parseMetadata<T extends z.ZodType<unknown>>(schema: T, row: unknown): z.infer<T> {
    const r = { ...(row as Record<string, unknown>) };
    
    // Parse JSON metadata if it's a string
    if (typeof r.metadata === 'string') {
      try {
        r.metadata = JSON.parse(r.metadata) as Record<string, unknown>;
      } catch {
        r.metadata = {};
      }
    }
    
    // Normalize null values for fields that Zod might expect to be optional/undefined
    this.normalizeFields(r);

    return schema.parse(r);
  }
}
