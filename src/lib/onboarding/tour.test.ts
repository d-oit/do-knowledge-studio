import { describe, expect, it } from 'vitest';
import { completeOnboarding, isOnboardingComplete, resetOnboarding } from './tour';

describe('onboarding tour state (#1064)', () => {
  it('round-trips completion in an isolated store', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    } as Storage;
    // NODE_ENV=test forces complete; exercise the storage path directly.
    completeOnboarding(storage);
    expect(map.size).toBe(1);
    resetOnboarding(storage);
    expect(map.size).toBe(0);
    expect(isOnboardingComplete(storage)).toBe(true);
  });
});
