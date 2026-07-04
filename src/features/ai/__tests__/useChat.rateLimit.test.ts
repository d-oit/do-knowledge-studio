// Wave 3 — work in progress (M12 rate-limit gating).
// The useChat hook integration with useRateLimiter is still being finalized.
// Remove the test.skip calls below once the source modules are stabilised.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../lib/llm/config', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    activeProvider: 'openrouter',
    providers: {
      openrouter: { apiKey: 'k', baseURL: 'https://x', defaultModel: 'm' },
    },
  }),
  saveConfig: vi.fn(),
  createProvider: vi.fn(),
  maskApiKey: vi.fn(),
}));

vi.mock('../../lib/search', () => ({
  searchKnowledge: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/resolver', () => ({
  resolveUrl: vi.fn(),
}));

vi.mock('../../lib/chat-persistence', () => ({
  loadChatHistory: vi.fn().mockResolvedValue([]),
  saveChatHistory: vi.fn().mockResolvedValue(),
  clearChatHistory: vi.fn().mockResolvedValue(),
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { useChat } from '../useChat';
import { useRateLimiter } from '../useRateLimiter';

describe('useChat rate-limit gating (M12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('appends a rate-limit message instead of sending when canRequest denies', async () => {
    const limiter = renderHook(() => useRateLimiter());
    const { result } = renderHook(() => useChat());

    for (let i = 0; i < 15; i++) {
      act(() => { limiter.result.current.trackRequest(); });
    }
    expect(limiter.result.current.canRequest().allowed).toBe(false);

    const before = result.current.messages.length;
    await act(async () => {
      await result.current.sendMessage('please answer', false);
    });
    const after = result.current.messages.length;

    expect(after).toBe(before + 1);
    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.role).toBe('assistant');
    expect(last.content.toLowerCase()).toContain('rate-limited');
  });
});
