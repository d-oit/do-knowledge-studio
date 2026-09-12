/**
 * Voice input i18n messages (N5).
 *
 * User-facing strings for `voice-input.tsx`: the recording toggle's
 * accessible labels.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible label while recording. */
  'voice.stopRecording': 'Stop recording',
  /** Accessible label when idle. */
  'voice.startInput': 'Start voice input',
} as const

/** Typed `translate` helper bound to the voice input message scope. */
export const translate = makeT(messages)