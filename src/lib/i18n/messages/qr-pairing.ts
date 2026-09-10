/**
 * QR pairing i18n messages (N5).
 *
 * User-facing strings for `qr-pairing.tsx`: QR display hint, copy button,
 * and the camera scanner states.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Copy-button accessible label. */
  'qr.copyRoomId': 'Copy room ID',
  /** Hint under the QR code. */
  'qr.scanHint': 'Scan this QR code with another device to pair',
  /** Camera error fallback when no error detail is available. */
  'qr.cameraDenied': 'Camera access denied',
  /** Camera error toast; error message interpolated. */
  'qr.cameraError': (msg: string) => `Camera error: ${msg}`,
  /** Stop-camera button accessible label. */
  'qr.stopCamera': 'Stop camera',
  /** Scan placeholder button label. */
  'qr.tapToScan': 'Tap to scan QR code',
  /** Hint under the scanner when idle. */
  'qr.pointHint': 'Point camera at QR code from another device',
} as const

/** Typed `translate` helper bound to the QR pairing message scope. */
export const translate = makeT(messages)