import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prefersReducedMotion, scrollIntoViewSmooth, animateWithMotionPreference } from '../motion';

describe('prefersReducedMotion', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { matchMedia: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when matchMedia returns false', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns true when matchMedia returns true', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('scrollIntoViewSmooth', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { matchMedia: vi.fn().mockReturnValue({ matches: false }) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when element is null', () => {
    const el = null;
    expect(() => scrollIntoViewSmooth(el)).not.toThrow();
  });

  it('calls scrollIntoView with smooth behavior', () => {
    const scrollIntoView = vi.fn();
    const el = { scrollIntoView } as unknown as HTMLElement;
    scrollIntoViewSmooth(el);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('uses instant behavior when reduced motion preferred', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const scrollIntoView = vi.fn();
    const el = { scrollIntoView } as unknown as HTMLElement;
    scrollIntoViewSmooth(el);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant' });
  });

  it('passes through custom options', () => {
    const scrollIntoView = vi.fn();
    const el = { scrollIntoView } as unknown as HTMLElement;
    scrollIntoViewSmooth(el, { block: 'center' });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });
});

describe('animateWithMotionPreference', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { matchMedia: vi.fn().mockReturnValue({ matches: false }) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls callback with final value immediately when reduced motion', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const callback = vi.fn();
    const onEnd = vi.fn();
    animateWithMotionPreference(0, 100, 300, callback, onEnd);
    expect(callback).toHaveBeenCalledWith(100);
    expect(onEnd).toHaveBeenCalled();
  });

  it('returns a cancel function', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const cancel = animateWithMotionPreference(0, 100, 300, vi.fn());
    expect(typeof cancel).toBe('function');
  });

  it('animates through requestAnimationFrame when motion allowed', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const callback = vi.fn();
    const onEnd = vi.fn();
    const cancel = animateWithMotionPreference(0, 100, 300, callback, onEnd);

    // Simulate first frame at t=150ms (50% progress)
    vi.mocked(performance.now).mockReturnValue(150);
    rafCallbacks[0](150);
    expect(callback).toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();

    // Simulate completion at t=300ms
    vi.mocked(performance.now).mockReturnValue(300);
    rafCallbacks[1](300);
    expect(onEnd).toHaveBeenCalled();

    // Test cancel
    cancel();
  });

  it('does not call callback after cancel', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) });

    const callback = vi.fn();
    const cancel = animateWithMotionPreference(0, 100, 300, callback);

    cancel();

    // Simulate frame after cancel
    vi.mocked(performance.now).mockReturnValue(150);
    rafCallbacks[0](150);
    expect(callback).not.toHaveBeenCalled();
  });
});
