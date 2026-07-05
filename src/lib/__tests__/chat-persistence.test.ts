import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../chat-persistence';

vi.mock('../logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('chat-persistence', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  const msg1 = { id: '100-abc', role: 'user' as const, content: 'Hello' };
  const msg2 = { id: '200-def', role: 'assistant' as const, content: 'Hi there' };

  it('saveChatHistory then loadChatHistory round-trips data', async () => {
    await saveChatHistory([msg1, msg2]);
    const loaded = await loadChatHistory();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].content).toBe('Hello');
    expect(loaded[1].content).toBe('Hi there');
  });

  it('loadChatHistory returns empty array on fresh DB', async () => {
    const loaded = await loadChatHistory();
    expect(loaded).toEqual([]);
  });

  it('loadChatHistory sorts by timestamp from id', async () => {
    await saveChatHistory([msg2, msg1]);
    const loaded = await loadChatHistory();
    expect(loaded[0].id).toBe('100-abc');
    expect(loaded[1].id).toBe('200-def');
  });

  it('clearChatHistory empties the store', async () => {
    await saveChatHistory([msg1]);
    await clearChatHistory();
    const loaded = await loadChatHistory();
    expect(loaded).toEqual([]);
  });

  it('saveChatHistory overwrites existing messages with same id', async () => {
    await saveChatHistory([msg1]);
    const updated = { ...msg1, content: 'Updated' };
    await saveChatHistory([updated]);
    const loaded = await loadChatHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe('Updated');
  });

  it('loadChatHistory returns empty on IDB error', async () => {
    vi.spyOn(console, 'warn').mockImplementation((..._args: unknown[]) => { void _args; });
    // Force openDB to fail by making indexedDB.open return a broken request
    const origOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (() => {
      const req = { onerror: null as ((ev: Event) => void) | null, onsuccess: null, onupgradeneeded: null, result: null };
      setTimeout(() => { req.onerror?.(new Event('error')); }, 0);
      return req;
    }) as typeof indexedDB.open;

    const loaded = await loadChatHistory();
    expect(loaded).toEqual([]);
    vi.restoreAllMocks();
    indexedDB.open = origOpen;
  });
});
