import { describe, expect, it } from 'vitest';
import { CONNECT_SRC_SOURCES, IMG_SRC_SOURCES } from './csp';

describe('csp allowlists (#1051)', () => {
  it('connect-src has no blanket https: or wss: sources', () => {
    expect(CONNECT_SRC_SOURCES).toContain("'self'");
    expect(CONNECT_SRC_SOURCES).not.toContain('https:');
    expect(CONNECT_SRC_SOURCES).not.toContain('wss:');
  });

  it('connect-src still permits the AI, model, signaling and loopback flows', () => {
    const joined = CONNECT_SRC_SOURCES.join(' ');
    expect(joined).toContain('https://openrouter.ai');
    expect(joined).toContain('https://huggingface.co');
    expect(joined).toContain('wss://y-webrtc-eu.fly.dev');
    expect(joined).toContain('http://localhost:*');
    expect(joined).toContain('http://*.local:*');
  });

  it('img-src has no blanket https: source', () => {
    expect(IMG_SRC_SOURCES).not.toContain('https:');
  });
});
