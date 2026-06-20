import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveUrl } from '../resolver';

describe('SSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    // Mock location for same-origin check
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://studio.local' },
        writable: true,
      });
    }
  });

  const blockedIps = [
    '127.0.0.1',
    '127.1',
    '127.0.0.2',
    '0.0.0.0',
    '0.1.2.3',
    '10.0.0.1',
    '192.168.1.1',
    '172.16.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.0.0.1',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    'localhost',
    '2130706433', // 127.0.0.1 decimal
    '0x7f.1', // 127.0.0.1 hex/decimal mix
    '0177.0.0.1', // 127.0.0.1 octal
    '[::1]',
    '[::]',
    '[fe80::1]',
    '[fc00::]',
    '[ff02::1]',
    '[::ffff:127.0.0.1]',
    '[::ffff:7f00:1]',
  ];

  it.each(blockedIps)('should block private/reserved IP: %s', async (host) => {
    const url = `http://${host}/test`;
    await expect(resolveUrl(url)).rejects.toThrow(/Blocked (private\/reserved IP|URL scheme)/i);
  });

  const allowedUrls = [
    'https://google.com',
    'https://github.com/trending',
    'https://en.wikipedia.org/wiki/SSRF',
    'http://8.8.8.8/test', // Public IP
    'http://1.1.1.1/',    // Public IP
  ];

  it.each(allowedUrls)('should allow public URL: %s', async (url) => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/markdown' },
      text: async () => '# Test\n\nContent',
    });

    const result = await resolveUrl(url);
    expect(result.url).toBe(url);
  });

  it('should block dangerous schemes', async () => {
    const dangerous = [
      'javascript:alert(1)',
      'data:text/html,<html>',
      'file:///etc/passwd',
      'ftp://example.com',
      'vbscript:msgbox(1)',
    ];

    for (const url of dangerous) {
      await expect(resolveUrl(url)).rejects.toThrow(/Blocked URL scheme/i);
    }
  });
});
