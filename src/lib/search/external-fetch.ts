import { repository } from '../../db/repository';
import { logger } from '../logger';
import { resolveUrl } from '../resolver';

export async function handleExternalFetch(url: string, entityId: string, upsertFn: (id: string) => Promise<void>): Promise<void> {
  try {
    logger.info('Handling external fetch for entity', { entityId, url });

    const cached = await repository.getWebCache(url);
    let resolved: { url: string; title: string; content: string; format: 'markdown' | 'plain'; wordCount: number; provider: string };
    if (cached?.content) {
      logger.info('Using cached web content', { url, cachedAt: cached.resolved_at });
      resolved = {
        url,
        title: cached.title || '',
        content: cached.content,
        format: (cached.format as 'markdown' | 'plain') || 'plain',
        wordCount: cached.content.split(/\s+/).filter(Boolean).length,
        provider: 'cache' as const,
      };
    } else {
      resolved = await resolveUrl(url);
    }

    if (resolved.content) {
      const titleToUse = resolved.title || '';
      const description = titleToUse
        ? `${titleToUse}\n\n${resolved.content}`
        : resolved.content;

      await repository.updateEntity(entityId, {
        description,
      });

      await repository.upsertWebCache(url, resolved.content, resolved.title, resolved.format);
      await upsertFn(entityId);

      logger.info('Entity auto-hydrated from external URL', {
        entityId,
        url,
        provider: resolved.provider,
        words: resolved.wordCount,
      });
    }
  } catch (err) {
    logger.error('Failed to auto-hydrate entity from external URL', err);
  }
}
