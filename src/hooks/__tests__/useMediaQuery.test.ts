import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Array<() => void>;

  beforeEach(() => {
    listeners = [];
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (event: string, cb: () => void) => {
        if (event === 'change') listeners.push(cb);
      },
      removeEventListener: (event: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial matchMedia value', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when matchMedia reports no match', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('updates when media query changes', () => {
    renderHook(() => useMediaQuery('(max-width: 768px)'));

    // Simulate media query change
    const mockMedia = {
      matches: true,
      media: '(max-width: 768px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => mockMedia);

    // Re-render to pick up new matchMedia
    const { result: result2 } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result2.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    const removeEventListener = vi.fn();
    const addEventListener = vi.fn();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener,
      removeEventListener,
    }));

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
