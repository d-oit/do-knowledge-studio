import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { RepositoryBase } from './base';

export async function upsertWebCache(base: RepositoryBase, url: string, content: string, title?: string, format: 'markdown' | 'plain' = 'plain'): Promise<void> {
  try {
    await base.exec({
      sql: `INSERT OR REPLACE INTO web_cache (url, content, format, title, resolved_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      bind: [url, content, format, title ?? null],
    });
  } catch (err) {
    logger.error('Failed to upsert web cache', err);
    throw new AppError('Failed to upsert web cache', 'DB_ERROR', err);
  }
}

export async function getWebCache(base: RepositoryBase, url: string): Promise<{ url: string; content: string; format: string; title?: string; resolved_at: string } | null> {
  try {
    const results = await base.exec({
      sql: `SELECT url, content, format, title, resolved_at FROM web_cache WHERE url = ?`,
      bind: [url],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const rows = z.array(z.unknown()).parse(results);
    if (rows.length === 0) return null;
    const r = rows[0] as Record<string, unknown>;
    return {
      url: String(r.url),
      content: String(r.content),
      format: String(r.format),
      title: typeof r.title === 'string' ? r.title : undefined,
      resolved_at: String(r.resolved_at),
    };
  } catch (err) {
    logger.error('Failed to get web cache', err);
    throw new AppError('Failed to get web cache', 'DB_ERROR', err);
  }
}
