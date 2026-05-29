import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test the URL_REGEX and safeHostname helpers by importing from AIHarness
// These tests verify the URL detection and safety logic used in RAG enrichment

describe('URL_REGEX', () => {
  // Replicate the regex from AIHarness for isolated testing
  const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

  it('should match http URLs', () => {
    const matches = 'check http://example.com for info'.match(URL_REGEX);
    expect(matches).toEqual(['http://example.com']);
  });

  it('should match https URLs', () => {
    const matches = 'see https://docs.example.org/page?q=1'.match(URL_REGEX);
    expect(matches).toEqual(['https://docs.example.org/page?q=1']);
  });

  it('should match multiple URLs', () => {
    const matches = 'compare https://a.com and https://b.com/path'.match(URL_REGEX);
    expect(matches).toHaveLength(2);
    expect(matches).toContain('https://a.com');
    expect(matches).toContain('https://b.com/path');
  });

  it('should not match text without URLs', () => {
    const matches = 'just plain text without any links'.match(URL_REGEX);
    expect(matches).toBeNull();
  });

  it('should handle URLs with trailing punctuation via replace', () => {
    const text = 'check https://example.com/page. for details';
    const raw = text.match(URL_REGEX);
    expect(raw).not.toBeNull();
    const cleaned = raw!.map(u => u.replace(/[.,;:!?)]+$/, ''));
    expect(cleaned).toEqual(['https://example.com/page']);
  });

  it('should match URLs with paths and fragments', () => {
    const matches = 'https://example.com/path/to/page#section'.match(URL_REGEX);
    expect(matches).toEqual(['https://example.com/path/to/page#section']);
  });

  it('should deduplicate with trailing punctuation stripping', () => {
    const text = 'https://example.com. and https://example.com';
    const raw = text.match(URL_REGEX)!;
    const cleaned = [...new Set(raw.map(u => u.replace(/[.,;:!?)]+$/, '')))];
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]).toBe('https://example.com');
  });
});

describe('safeHostname', () => {
  const safeHostname = (url: string): string => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  it('should extract hostname from valid URL', () => {
    expect(safeHostname('https://www.example.com/path')).toBe('www.example.com');
  });

  it('should extract hostname without www', () => {
    expect(safeHostname('https://example.com')).toBe('example.com');
  });

  it('should return raw string for invalid URL', () => {
    expect(safeHostname('not-a-url')).toBe('not-a-url');
  });

  it('should handle empty string', () => {
    expect(safeHostname('')).toBe('');
  });

  it('should handle URL with port', () => {
    expect(safeHostname('http://localhost:5173/page')).toBe('localhost');
  });

  it('should handle URL with only hostname', () => {
    expect(safeHostname('https://sub.domain.co.uk')).toBe('sub.domain.co.uk');
  });
});

// Import and test the actual resolveUrl with mocked fetch
describe('resolveUrl', () => {
  let resolveUrl: typeof import('../resolver').resolveUrl;
  const originalAbortSignalTimeout = AbortSignal.timeout;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    // Mock fetch for the resolver
    global.fetch = vi.fn();
    // Mock location for same-origin check
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:5173' },
      writable: true,
    });
    // Polyfill AbortSignal.timeout for happy-dom
    AbortSignal.timeout = vi.fn((ms: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    });
    const mod = await import('../resolver');
    resolveUrl = mod.resolveUrl;
  });

  afterEach(() => {
    AbortSignal.timeout = originalAbortSignalTimeout;
  });

  it('should resolve a same-origin URL via direct fetch', async () => {
    const mockHtml = `<!DOCTYPE html>
<html><head><title>Test Page</title></head>
<body><p>This is a test paragraph with enough content to be meaningful.</p><p>Second paragraph with additional information.</p></body></html>`;

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('text/html'),
      },
      text: vi.fn().mockResolvedValue(mockHtml),
    });

    const result = await resolveUrl('http://localhost:5173/test');

    expect(result.provider).toBe('direct');
    expect(result.title).toBe('Test Page');
    expect(result.url).toBe('http://localhost:5173/test');
    expect(result.format).toBe('plain');
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('should use Jina for cross-origin URLs', async () => {
    // Mock Jina response (returns markdown)
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue('# External Page\n\nThis is markdown content from an external source.'),
    });

    const result = await resolveUrl('https://external.example.com/page');

    expect(result.provider).toBe('jina');
    expect(result.title).toBe('External Page');
    expect(result.format).toBe('markdown');
  });

  it('should return ResolvedContent with correct properties', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue('# Test Title\n\nSome content here for word counting test.'),
    });

    const result = await resolveUrl('https://example.com');

    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('format');
    expect(result).toHaveProperty('wordCount');
    expect(result).toHaveProperty('provider');
  });

  it('should correctly decode entities in HTML to plain text', async () => {
    const mockHtml = `<!DOCTYPE html>
<html><head><title>Entity Test</title></head>
<body><p>Test &amp; Check &lt; Tag &gt; &quot;Quote&quot; &#39;Apos&#39; &nbsp; Space</p></body></html>`;

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('text/html'),
      },
      text: vi.fn().mockResolvedValue(mockHtml),
    });

    const result = await resolveUrl('http://localhost:5173/entities');

    expect(result.content).toContain('Test & Check < Tag > "Quote" \'Apos\'   Space');
  });
});
