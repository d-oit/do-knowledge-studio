/**
 * QR Code Pairing for P2P Sync.
 *
 * Generates QR codes containing WebRTC SDP offers for pairing.
 * The scanning peer decodes the QR and completes the connection.
 */
import QRCode from 'qrcode';
import type { PeerConnection } from './peer';
import { createOffer, handleAnswer, setupDataChannel } from './peer';
import type { SyncCallbacks } from './peer';

export interface PairingResult {
  peer: PeerConnection;
  answerBase64: string;
}

export async function generatePairingQR(
  peer: PeerConnection,
): Promise<string> {
  const offer = await createOffer(peer);
  const qrDataUrl = await QRCode.toDataURL(offer, {
    width: 256,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  return qrDataUrl;
}

export async function scanAndConnect(
  peer: PeerConnection,
  offerBase64: string,
  callbacks: SyncCallbacks = {},
): Promise<PeerConnection> {
  await handleOffer(peer, offerBase64); // eslint-disable-line @typescript-eslint/no-unsafe-call -- WebRTC SDP exchange
  setupDataChannel(peer, callbacks);
  return peer;
}

export async function completePairing(
  peer: PeerConnection,
  answerBase64: string,
  callbacks: SyncCallbacks = {},
): Promise<PeerConnection> {
  await handleAnswer(peer, answerBase64);
  setupDataChannel(peer, callbacks);
  return peer;
}

export function decodePairingData(qrData: string): string | null {
  try {
    const decoded = atob(qrData);
    JSON.parse(decoded); // Validate it's valid JSON (SDP offer)
    return qrData;
  } catch {
    return null;
  }
}
