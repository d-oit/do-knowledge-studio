/**
 * WebRTC Peer Connection Manager.
 *
 * Manages peer-to-peer connections using native WebRTC API.
 * Uses a signaling channel (manual exchange via QR code) to establish connections.
 */
import { logger } from '../logger';
import { SyncSnapshotSchema, SyncMessageSchema } from './protocol';
import { createSyncSnapshot, mergeSnapshots } from './protocol';
import { repository } from '../../db/repository';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type PeerState = 'idle' | 'connecting' | 'connected' | 'syncing' | 'error';

export interface PeerConnection {
  id: string;
  state: PeerState;
  rtcpeer: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
}

export interface SyncCallbacks {
  onStateChange?: (state: PeerState) => void;
  onSyncComplete?: (result: { merged: number; conflicts: number }) => void;
  onError?: (error: string) => void;
}

let deviceId = '';
function getDeviceId(): string {
  if (!deviceId) {
    deviceId = localStorage.getItem('dks:device-id') ?? crypto.randomUUID();
    localStorage.setItem('dks:device-id', deviceId);
  }
  return deviceId;
}

export function createPeerConnection(callbacks: SyncCallbacks = {}): PeerConnection {
  const id = crypto.randomUUID();
  const rtcpeer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  const peer: PeerConnection = {
    id,
    state: 'idle',
    rtcpeer,
    dataChannel: null,
  };

  rtcpeer.onicecandidate = (event) => {
    if (event.candidate) {
      logger.debug('ICE candidate', { candidate: event.candidate.candidate });
    }
  };

  rtcpeer.onconnectionstatechange = () => {
    const state = rtcpeer.connectionState;
    if (state === 'connected') {
      peer.state = 'connected';
      callbacks.onStateChange?.('connected');
    } else if (state === 'failed' || state === 'disconnected') {
      peer.state = 'error';
      callbacks.onStateChange?.('error');
      callbacks.onError?.(`Connection ${state}`);
    }
  };

  return peer;
}

export async function createOffer(peer: PeerConnection): Promise<string> {
  peer.state = 'connecting';
  const offer = await peer.rtcpeer.createOffer();
  await peer.rtcpeer.setLocalDescription(offer);
  return btoa(JSON.stringify(offer));
}

export async function handleOffer(
  peer: PeerConnection,
  offerBase64: string,
): Promise<string> {
  peer.state = 'connecting';
  const offer = JSON.parse(atob(offerBase64)) as RTCSessionDescriptionInit;
  await peer.rtcpeer.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peer.rtcpeer.createAnswer();
  await peer.rtcpeer.setLocalDescription(answer);
  return btoa(JSON.stringify(answer));
}

export async function handleAnswer(
  peer: PeerConnection,
  answerBase64: string,
): Promise<void> {
  const answer = JSON.parse(atob(answerBase64)) as RTCSessionDescriptionInit;
  await peer.rtcpeer.setRemoteDescription(new RTCSessionDescription(answer));
}

export function setupDataChannel(
  peer: PeerConnection,
  callbacks: SyncCallbacks = {},
): RTCDataChannel {
  const channel = peer.rtcpeer.createDataChannel('sync', {
    ordered: true,
  });

  channel.onopen = () => {
    logger.info('Data channel opened');
    peer.dataChannel = channel;
  };

  channel.onmessage = async (event) => {
    try {
      const raw: unknown = JSON.parse(event.data as string);
      const msgResult = SyncMessageSchema.safeParse(raw);
      if (!msgResult.success) {
        logger.warn('Invalid sync message format', msgResult.error);
        return;
      }
      const msg = msgResult.data;

      if (msg.type === 'sync-request') {
        peer.state = 'syncing';
        callbacks.onStateChange?.('syncing');

        const entities = await repository.getAllEntities();
        const links = await repository.getAllLinks();
        const claimsGrouped = await repository.getAllClaimsGroupedByEntity();
        const claims = Object.values(claimsGrouped).flat();
        const notesGrouped = await repository.getAllNotesGroupedByEntity();
        const notes = Object.values(notesGrouped).flat();

        const snapshot = createSyncSnapshot(entities, claims, notes, links, getDeviceId());
        channel.send(JSON.stringify({ type: 'sync-data', data: snapshot }));
      } else if (msg.type === 'sync-data') {
        peer.state = 'syncing';
        callbacks.onStateChange?.('syncing');

        const snapshotResult = SyncSnapshotSchema.safeParse(msg.data);
        if (!snapshotResult.success) {
          logger.warn('Invalid sync snapshot from peer', snapshotResult.error);
          peer.state = 'error';
          callbacks.onError?.('Invalid data received from peer');
          return;
        }
        const remoteSnapshot = snapshotResult.data;

        const localEntities = await repository.getAllEntities();
        const localLinks = await repository.getAllLinks();
        const localClaimsGrouped = await repository.getAllClaimsGroupedByEntity();
        const localClaims = Object.values(localClaimsGrouped).flat();
        const localNotesGrouped = await repository.getAllNotesGroupedByEntity();
        const localNotes = Object.values(localNotesGrouped).flat();

        const localSnapshot = createSyncSnapshot(localEntities, localClaims, localNotes, localLinks, getDeviceId());
        const { merged, conflicts } = mergeSnapshots(localSnapshot, remoteSnapshot);

        // Apply merged data
        for (const entity of merged.entities) {
          try {
            const existing = entity.id ? await repository.getEntityById(entity.id) : null;
            if (!existing && entity.id) {
              await repository.createEntity({
                name: entity.name,
                type: entity.type,
                description: entity.description,
                sourceUrl: entity.sourceUrl,
              });
            }
          } catch {
            // Skip duplicates
          }
        }

        for (const link of merged.links) {
          try {
            await repository.createLink({
              source_id: link.source_id,
              target_id: link.target_id,
              relation: link.relation,
            });
          } catch {
            // Skip duplicates
          }
        }

        channel.send(JSON.stringify({ type: 'sync-ack', data: { merged: merged.entities.length, conflicts } }));
        peer.state = 'connected';
        callbacks.onStateChange?.('connected');
        callbacks.onSyncComplete?.({ merged: merged.entities.length, conflicts });
      } else if (msg.type === 'sync-ack') {
        peer.state = 'connected';
        callbacks.onStateChange?.('connected');
        const result = msg.data as { merged: number; conflicts: number };
        callbacks.onSyncComplete?.(result);
      }
    } catch (err) {
      logger.error('Failed to handle sync message', err);
      callbacks.onError?.(String(err));
    }
  };

  channel.onerror = (event) => {
    logger.error('Data channel error', event);
    callbacks.onError?.('Data channel error');
  };

  return channel;
}

export function initiateSync(peer: PeerConnection): void {
  if (peer.dataChannel?.readyState === 'open') {
    peer.dataChannel.send(JSON.stringify({ type: 'sync-request', data: null }));
  }
}

export function closePeer(peer: PeerConnection): void {
  peer.dataChannel?.close();
  peer.rtcpeer.close();
  peer.state = 'idle';
}
