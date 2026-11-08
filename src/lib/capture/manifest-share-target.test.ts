import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('manifest share_target (#1061)', () => {
  it('exposes a GET share_target for text/title/url', () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'public', 'manifest.webmanifest'), 'utf8'),
    ) as {
      share_target?: { action?: string; method?: string; params?: Record<string, string> };
    };
    expect(manifest.share_target?.method).toBe('GET');
    expect(manifest.share_target?.action).toContain('share=1');
    expect(manifest.share_target?.params).toMatchObject({ title: 'title', text: 'text', url: 'url' });
  });
});
