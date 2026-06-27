import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

// Must import after stubbing localStorage
import { recordSuccess, recordFailure, shouldSkip, getDomainStats, resetMemory } from '../routing-memory';

describe('routing-memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    resetMemory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records success for a URL', () => {
    recordSuccess('https://example.com/article');
    const stats = getDomainStats('https://example.com/other');
    expect(stats).not.toBeNull();
    expect(stats?.successes).toBe(1);
    expect(stats?.state).toBe('closed');
  });

  it('records failure for a URL', () => {
    recordFailure('https://example.com/article');
    const stats = getDomainStats('https://example.com/other');
    expect(stats).not.toBeNull();
    expect(stats?.failures).toBe(1);
    expect(stats?.state).toBe('closed');
  });

  it('opens circuit after threshold failures', () => {
    for (let i = 0; i < 3; i++) {
      recordFailure('https://failing.example.com/page');
    }
    expect(shouldSkip('https://failing.example.com/other')).toBe(true);
  });

  it('does not skip before threshold', () => {
    for (let i = 0; i < 2; i++) {
      recordFailure('https://example.com/page');
    }
    expect(shouldSkip('https://example.com/other')).toBe(false);
  });

  it('does not skip unknown domains', () => {
    expect(shouldSkip('https://unknown.com/page')).toBe(false);
  });

  it('resets after success', () => {
    for (let i = 0; i < 3; i++) {
      recordFailure('https://example.com/page');
    }
    expect(shouldSkip('https://example.com/other')).toBe(true);

    recordSuccess('https://example.com/page');
    expect(shouldSkip('https://example.com/other')).toBe(false);
  });

  it('persists to localStorage', () => {
    recordSuccess('https://example.com/page');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'dks:routing-memory',
      expect.any(String)
    );
  });
});
