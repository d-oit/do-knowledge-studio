import { memo, useCallback, useEffect, useState } from 'react';
import { useStudioStore } from '@/lib/studio/store';
import { useReducedMotion } from '@/lib/studio/use-reduced-motion';
import {
  TOUR_STEPS,
  completeOnboarding,
  isOnboardingComplete,
  type TourStep,
} from '@/lib/onboarding/tour';
import { translate } from '@/lib/i18n/messages/onboarding';

/** Step copy for the 5-step skippable tour. */
const STEP_COPY: Record<TourStep, { title: string; body: string }> = {
  editor: { title: 'Editor', body: 'Capture notes and claims with markdown, tags and links.' },
  library: { title: 'Library', body: 'Browse, search and filter every entity.' },
  graph: { title: 'Graph', body: 'See how entities connect.' },
  chat: { title: 'Chat', body: 'Ask with citations back to your notes.' },
  backup: { title: 'Backup', body: 'Export verified backups before you need them.' },
};

/**
 * First-run gate (#1064): choice screen then 5-step skippable, keyboard
 * accessible tour. Respects `prefers-reduced-motion` (no auto-advance, no
 * animation). Returning profiles render nothing.
 */
export const OnboardingGate = memo(function OnboardingGate() {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const navigateToView = useStudioStore((s) => s.navigateToView);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    const timer = requestAnimationFrame(() => {
      if (!cancelled && !isOnboardingComplete()) setVisible(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(timer);
    };
  }, []);

  const finish = useCallback(() => {
    completeOnboarding();
    setVisible(false);
  }, []);

  const goStep = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
      setStepIndex(clamped);
      // Explicit branches: dynamic TOUR_STEPS[clamped] trips
      // security/detect-object-injection (same pattern as the synthesis
      // provider-label fix).
      if (clamped === 0) {
        navigateToView('editor');
      } else if (clamped === 1) {
        navigateToView('library');
      } else if (clamped === 2) {
        navigateToView('graph');
      } else if (clamped === 3) {
        navigateToView('chat');
      } else {
        navigateToView('export');
      }
    },
    [navigateToView],
  );

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') goStep(stepIndex + 1);
      if (e.key === 'ArrowLeft') goStep(stepIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [visible, stepIndex, goStep, finish]);

  if (!visible) return null;
  // Explicit step resolution (see goStep): no dynamic index into tour state.
  const copy =
    stepIndex === 1
      ? STEP_COPY.library
      : stepIndex === 2
        ? STEP_COPY.graph
        : stepIndex === 3
          ? STEP_COPY.chat
          : stepIndex >= 4
            ? STEP_COPY.backup
            : STEP_COPY.editor;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={translate('onboarding.tourTitle')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
        <h2 className="font-serif text-h2">{translate('onboarding.choiceTitle')}</h2>
        <p className="mt-1 text-body text-ink-mute">{translate('onboarding.choiceBody')}</p>
        <div
          className={reducedMotion ? 'mt-4' : 'mt-4 animate-in fade-in'}
          aria-live="polite"
        >
          <p className="text-caption font-medium uppercase tracking-wide text-ink-faint">
            {stepIndex + 1} / {TOUR_STEPS.length} · {copy.title}
          </p>
          <p className="mt-1 text-body">{copy.body}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              goStep(stepIndex - 1);
            }}
            disabled={stepIndex === 0}
            className="min-h-[44px] rounded-md border border-border px-4 py-2 text-body disabled:opacity-50"
          >
            {translate('onboarding.back')}
          </button>
          {stepIndex < TOUR_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                goStep(stepIndex + 1);
              }}
              className="min-h-[44px] rounded-md bg-saffron px-4 py-2 text-body font-medium text-white"
            >
              {translate('onboarding.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="min-h-[44px] rounded-md bg-saffron px-4 py-2 text-body font-medium text-white"
            >
              {translate('onboarding.done')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              finish();
            }}
            className="min-h-[44px] rounded-md border border-border px-4 py-2 text-body"
          >
            {translate('onboarding.skip')}
          </button>
        </div>
      </div>
    </div>
  );
});
