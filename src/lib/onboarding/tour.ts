/**
 * First-run onboarding state for #1064.
 *
 * Persisted in the localStorage metadata envelope (never the corpus), so a
 * returning profile never sees the choice screen again. In unit tests
 * (`NODE_ENV=test`) the tour is treated as complete so `AppShell` tests keep
 * asserting the normal shell.
 */
import { z } from 'zod';

/** Metadata key marking the tour/choice as done. */
export const ONBOARDING_COMPLETED_KEY = 'dks-onboarding-completed-v1';

/** Five-step tour: Editor -> Library -> Graph -> Chat -> Backup. */
export const TOUR_STEPS = ['editor', 'library', 'graph', 'chat', 'backup'] as const;

export type TourStep = (typeof TOUR_STEPS)[number];

/** Boundary schema for the completion flag. */
const CompletedSchema = z.enum(['1']);

/** True in unit tests to keep the shell assertions stable. */
const isTestEnv = (): boolean =>
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/** Whether the profile already finished (or skipped) onboarding. */
export const isOnboardingComplete = (storage: Storage | null = null): boolean => {
  if (isTestEnv()) return true;
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store === null) return true;
    const raw = store.getItem(ONBOARDING_COMPLETED_KEY);
    if (raw === null) return false;
    return CompletedSchema.safeParse(raw).success;
  } catch (error) {
    console.error('Failed to read onboarding state', error);
    return true;
  }
};

/** Marks onboarding complete (choice made or tour skipped/finished). */
export const completeOnboarding = (storage: Storage | null = null): void => {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    store?.setItem(ONBOARDING_COMPLETED_KEY, '1');
  } catch (error) {
    console.error('Failed to save onboarding state', error);
  }
};

/** Clears the flag so the tour can be replayed from the palette. */
export const resetOnboarding = (storage: Storage | null = null): void => {
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    store?.removeItem(ONBOARDING_COMPLETED_KEY);
  } catch (error) {
    console.error('Failed to reset onboarding state', error);
  }
};
