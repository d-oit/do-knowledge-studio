import { logger } from './logger';

const BLOCKED_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

function isPrivateIP(hostname: string): boolean {
  // Normalize hostname: lowercase, strip trailing dot, and strip IPv6 brackets
  const normalized = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[(.+)\]$/, '$1');

  if (normalized === 'localhost') {
    return true;
  }

  // IPv4 Private and Reserved Ranges
  if (
    /^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0)$/.test(
      normalized,
    )
  ) {
    return true;
  }

  // IPv6 Loopback, Link-Local, and Unique Local Addresses
  if (
    /^::1$/.test(normalized) || // Loopback
    /^::$/.test(normalized) || // Unspecified
    /^fe[89ab][0-9a-f]:/i.test(normalized) || // Link-local
    /^f[cd][0-9a-f]{2}:/i.test(normalized) || // Unique local (fc00::/7)
    /^::ffff:([0-9a-f]{1,4}:){1,2}[0-9a-f]{1,4}$/.test(normalized) || // IPv4-mapped (covers all, as we can't easily parse hex here)
    /^::ffff:\d+\.\d+\.\d+\.\d+$/.test(normalized) // IPv4-mapped literal
  ) {
    return true;
  }

  return false;
}

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
  // Remove script/style content
  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  
  // Replace block elements with newlines
  let text = stripped
    .replace(/<\/?(p|div|h[1-6]|li|tr|br|article|section|aside)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  // Decode common entities using a single pass to avoid double-unescaping (CodeQL)
  // We use a non-capturing group for the entity name to satisfy CodeQL's concern
  // about producing '&' characters that could be further processed.
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };
  text = text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (match) => entities[match] || match);
  
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
    } catch (err) {
      logger.debug('Direct fetch failed, falling back to Jina reader', { url, error: String(err) });
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

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    logger.debug('Invalid URL provided to resolveUrl', { url, error: String(err) });
    throw new Error(`Invalid URL: ${url}`);
  }

  if (BLOCKED_SCHEMES.some(scheme => parsed.protocol.toLowerCase().startsWith(scheme))) {
    throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
  }

  if (isPrivateIP(parsed.hostname)) {
    throw new Error(`Blocked private/reserved IP: ${parsed.hostname}`);
  }

  const { title, content, provider } = await fetchAndParse(url);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return { url, title, content, format: provider === 'jina' ? 'markdown' : 'plain', wordCount, provider };
};
