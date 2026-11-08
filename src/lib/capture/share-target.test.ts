import { describe, expect, it } from 'vitest';
import { buildCaptureBody, parseShareParams, sanitizeShareField } from './share-target';

describe('share_target parsing (#1061)', () => {
  it('returns null without the share flag', () => {
    expect(parseShareParams('?text=hello')).toBeNull();
  });

  it('parses text/title/url and caps length', () => {
    const payload = parseShareParams('?share=1&title=Hi&text=Hello&url=https://example.com/a');
    expect(payload?.text).toBe('Hello');
    expect(payload?.url).toBe('https://example.com/a');
    expect(buildCaptureBody(payload!)).toContain('Hello');
  });

  it('rejects non-http(s) urls but keeps text', () => {
    const payload = parseShareParams('?share=1&text=hi&url=javascript:alert(1)');
    expect(payload?.url).toBe('');
    expect(payload?.text).toBe('hi');
  });

  it('strips control chars and caps', () => {
    expect(sanitizeShareField('a\u0000b')).toBe('ab');
    expect(sanitizeShareField('x'.repeat(5000)).length).toBeLessThanOrEqual(4000);
  });
});
