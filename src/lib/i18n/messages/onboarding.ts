/**
 * Onboarding messages (#1064), translatable via the catalog convention.
 */
import { makeT } from '@/lib/i18n/t';

const messages = {
  /** Choice screen heading for new profiles. */
  'onboarding.choiceTitle': 'Welcome to Knowledge Studio',
  /** Choice screen body. */
  'onboarding.choiceBody': 'Your library stays in this browser. Start with a sample library, start empty, or import a backup.',
  /** Start with seed data. */
  'onboarding.startSample': 'Start with sample library',
  /** Start empty. */
  'onboarding.startEmpty': 'Start empty',
  /** Open import. */
  'onboarding.startImport': 'Import a backup',
  /** Tour heading. */
  'onboarding.tourTitle': 'Take the tour',
  /** Skip action. */
  'onboarding.skip': 'Skip tour',
  /** Next step. */
  'onboarding.next': 'Next',
  /** Back step. */
  'onboarding.back': 'Back',
  /** Finish. */
  'onboarding.done': 'Done',
  /** Replay command in the palette. */
  'onboarding.replay': 'Replay guided tour',
  /** Privacy panel heading. */
  'onboarding.privacyTitle': 'Privacy at a glance',
  /** Privacy panel body. */
  'onboarding.privacyBody':
    'Notes, graph and mind map stay on this device. Only opt-in flows leave: AI providers, web research, signaling/model downloads. Details in ADR 045.',
} as const;

/** Typed translate helper for the onboarding scope. */
export const translate = makeT(messages);
