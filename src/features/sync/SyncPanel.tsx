import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Wifi, WifiOff, Loader2, QrCode, Scan, X, Check, AlertTriangle } from 'lucide-react';
import { createPeerConnection, closePeer, initiateSync, type PeerState } from '../../lib/sync/peer';
import { generatePairingQR, completePairing, decodePairingData } from '../../lib/sync/qr-pairing';

interface SyncPanelProps {
  onClose: () => void;
}

const SyncPanel: React.FC<SyncPanelProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'idle' | 'host' | 'guest'>('idle');
  const [peerState, setPeerState] = useState<PeerState>('idle');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [syncResult, setSyncResult] = useState<{ merged: number; conflicts: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<ReturnType<typeof createPeerConnection> | null>(null);

  const cleanup = useCallback(() => {
    if (peerRef.current) {
      closePeer(peerRef.current);
      peerRef.current = null;
    }
    setMode('idle');
    setPeerState('idle');
    setQrDataUrl(null);
    setScanInput('');
    setSyncResult(null);
    setError(null);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const handleStartHost = useCallback(async () => {
    try {
      setMode('host');
      setError(null);
      const peer = createPeerConnection({
        onStateChange: setPeerState,
        onSyncComplete: (result) => {
          setSyncResult(result);
          setPeerState('connected');
        },
        onError: setError,
      });
      peerRef.current = peer;
      const qr = await generatePairingQR(peer);
      setQrDataUrl(qr);
    } catch (err) {
      setError(String(err));
      setMode('idle');
    }
  }, []);

  const handleStartGuest = useCallback(() => {
    setMode('guest');
    setError(null);
    const peer = createPeerConnection({
      onStateChange: setPeerState,
      onSyncComplete: (result) => {
        setSyncResult(result);
        setPeerState('connected');
      },
      onError: setError,
    });
    peerRef.current = peer;
  }, []);

  const handleGuestConnect = useCallback(async () => {
    if (!peerRef.current || !scanInput.trim()) return;
    try {
      const data = decodePairingData(scanInput.trim());
      if (!data) {
        setError('Invalid QR code data');
        return;
      }
      await completePairing(peerRef.current, data, {
        onStateChange: setPeerState,
        onSyncComplete: (result) => {
          setSyncResult(result);
          setPeerState('connected');
        },
        onError: setError,
      });
      // Host initiates sync, guest waits
    } catch (err) {
      setError(String(err));
    }
  }, [scanInput]);

  const handleStartSync = useCallback(() => {
    if (peerRef.current) {
      initiateSync(peerRef.current);
    }
  }, []);

  return (
    <div className="sync-panel" style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '100vw',
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
      zIndex: 'var(--z-overlay)', display: 'flex', flexDirection: 'column',
      boxShadow: 'var(--shadow-lg)',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wifi size={18} />
          <h3 style={{ margin: 0 }}>P2P Sync</h3>
        </div>
        <button type="button" onClick={() => { cleanup(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {mode === 'idle' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Wifi size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
            <h4 style={{ marginBottom: '8px' }}>Sync with Another Device</h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              Connect two devices on the same network to sync your knowledge base.
            </p>
            <button type="button" className="primary" onClick={() => { void handleStartHost(); }} style={{ width: '100%', marginBottom: '12px' }}>
              <QrCode size={16} style={{ marginRight: '8px' }} /> Host Sync (Show QR)
            </button>
            <button type="button" className="btn-secondary" onClick={handleStartGuest} style={{ width: '100%' }}>
              <Scan size={16} style={{ marginRight: '8px' }} /> Join Sync (Scan QR)
            </button>
          </div>
        )}

        {mode === 'host' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <h4 style={{ marginBottom: '12px' }}>Scan this QR Code</h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
              Have the other device scan this code to connect.
            </p>
            {qrDataUrl && (
              <div style={{ display: 'inline-block', padding: '12px', background: '#fff', borderRadius: '12px', marginBottom: '16px' }}>
                <img src={qrDataUrl} alt="QR Code for pairing" style={{ width: '200px', height: '200px' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
              <PeerStateBadge state={peerState} />
            </div>
            {peerState === 'connected' && (
              <button type="button" className="primary" onClick={handleStartSync} style={{ width: '100%' }}>
                Start Sync
              </button>
            )}
            {syncResult && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--status-success-bg)', borderRadius: '8px', fontSize: '13px' }}>
                <Check size={16} style={{ marginRight: '8px', color: 'var(--status-success)' }} />
                Synced {syncResult.merged} items ({syncResult.conflicts} conflicts resolved)
              </div>
            )}
          </div>
        )}

        {mode === 'guest' && (
          <div style={{ padding: '16px 0' }}>
            <h4 style={{ marginBottom: '12px' }}>Enter QR Code Data</h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
              Paste the QR code data or scan with a QR reader app.
            </p>
            <textarea
              value={scanInput}
              onChange={e => { setScanInput(e.target.value); }}
              placeholder="Paste QR code data here..."
              style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-default)', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
            />
            <button type="button" className="primary" onClick={() => { void handleGuestConnect(); }} disabled={!scanInput.trim()} style={{ width: '100%', marginTop: '12px' }}>
              Connect
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
              <PeerStateBadge state={peerState} />
            </div>
            {syncResult && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--status-success-bg)', borderRadius: '8px', fontSize: '13px' }}>
                <Check size={16} style={{ marginRight: '8px', color: 'var(--status-success)' }} />
                Synced {syncResult.merged} items ({syncResult.conflicts} conflicts resolved)
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--status-danger-bg)', borderRadius: '8px', fontSize: '13px', color: 'var(--status-danger)' }}>
            <AlertTriangle size={14} style={{ marginRight: '8px' }} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

const PeerStateBadge: React.FC<{ state: PeerState }> = ({ state }) => {
  const colors: Record<PeerState, string> = {
    idle: 'var(--text-muted)',
    connecting: 'var(--status-warning)',
    connected: 'var(--status-success)',
    syncing: 'var(--interactive-primary)',
    error: 'var(--status-danger)',
  };
  const labels: Record<PeerState, string> = {
    idle: 'Idle',
    connecting: 'Connecting...',
    connected: 'Connected',
    syncing: 'Syncing...',
    error: 'Error',
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors[state] }}>
      {state === 'connecting' || state === 'syncing' ? (
        <Loader2 size={14} className="animate-spin" />
      ) : state === 'connected' ? (
        <Wifi size={14} />
      ) : state === 'error' ? (
        <WifiOff size={14} />
      ) : null}
      {labels[state]}
    </span>
  );
};

export default SyncPanel;
