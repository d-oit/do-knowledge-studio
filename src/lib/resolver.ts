import DOMPurify from 'dompurify';
import { logger } from './logger';

/** Resolved web content ready for entity hydration. */
export interface ResolvedContent {
  url: string;
  title: string;
  content: string;
  format: 'markdown' | 'plain';
  wordCount: number;
  provider: 'direct' | 'jina' | 'cache';
  cachedAt?: string;
}

/** Normalize text by collapsing whitespace and trimming. */
const normalizeText = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

/** Strip HTML tags and decode entities, producing plain text. */
const htmlToPlainText = (html: string): string => {
  // Use DOMPurify to remove all HTML tags and dangerous content
  const cleanHtml = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  
  // Decode common HTML entities
  const text = cleanHtml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  return text;
};

/** Extract the page title from HTML, stripping any nested tags. */
const extractTitle = (html: string): string => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeText(match[1].replace(/<[^>]*>/g, '')) : '';
};

/** Extract first meaningful paragraph(s) as a summary (up to 2000 chars). */
const extractSummary = (text: string, maxChars = 2000): string => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 40);
  let summary = '';
  for (const line of lines) {
    if (summary.length + line.length > maxChars) break;
    summary += (summary ? '\n\n' : '') + line;
  }
  return summary || text.slice(0, maxChars);
};

/**
 * Fetch a URL using Jina AI's reader (free, returns clean markdown).
 * @see https://r.jina.ai
 */
const fetchViaJina = async (url: string): Promise<string> => {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const response = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/markdown',
      'X-No-Cache': 'true',
    },
  });
  if (!response.ok) {
    throw new Error(`Jina reader returned ${response.status}`);
  }
  return response.text();
};

/**
 * Fetch a URL via Jina AI reader (preferred for cross-origin browser fetches).
 * Falls back to direct fetch for same-origin URLs to avoid unnecessary redirect.
 */
const fetchAndParse = async (url: string): Promise<{ title: string; content: string; provider: 'direct' | 'jina' }> => {
  const isSameOrigin = typeof location !== 'undefined' && (() => {
    try { return new URL(url).origin === location.origin; } catch { return false; }
  })();

  // Direct fetch for same-origin URLs (avoids Jina roundtrip)
  if (isSameOrigin) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();

        if (contentType.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          const title = extractTitle(text);
          const plainText = htmlToPlainText(text);
          const summary = extractSummary(plainText);
          return { title, content: summary, provider: 'direct' };
        }

        const firstLine = text.trim().split('\n')[0].replace(/^#+\s*/, '');
        return {
          title: firstLine.slice(0, 200) || new URL(url).hostname,
          content: text.slice(0, 10000),
          provider: 'direct',
        };
      }
    } catch {
      logger.info('Direct fetch failed, falling back to Jina reader', { url });
    }
  }

  // Jina AI reader for cross-origin URLs (free, CORS-friendly, clean markdown)
  const markdown = await fetchViaJina(url);
  const lines = markdown.trim().split('\n');
  const titleLine = lines.find(l => l.startsWith('# '))?.replace(/^#+\s*/, '') ||
                    lines.find(l => l.startsWith('Title: '))?.replace(/^Title:\s*/, '') ||
                    '';

  return {
    title: titleLine.slice(0, 255),
    content: markdown.slice(0, 10000),
    provider: 'jina',
  };
};

/**
 * Resolve a URL into structured content suitable for entity hydration.
 *
 * Uses Jina AI reader for cross-origin URLs, direct fetch for same-origin.
 * Results should be cached in the web_cache table via the repository for offline use.
 *
 * @param url - The URL to resolve.
 * @returns Resolved content with title, text body, and provider metadata.
 */
export const resolveUrl = async (url: string): Promise<ResolvedContent> => {
  logger.info('Resolving URL', { url });
  const { title, content, provider } = await fetchAndParse(url);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return { url, title, content, format: provider === 'jina' ? 'markdown' : 'plain', wordCount, provider };
};
