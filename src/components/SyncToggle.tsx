import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useGraphSyncStore } from '../store/graph-sync-store';

interface SyncToggleProps {
  tooltip?: string;
}

const SyncToggle: React.FC<SyncToggleProps> = ({
  tooltip = "Sync mind map with knowledge graph"
}) => {
  const { syncEnabled, setSyncEnabled } = useGraphSyncStore();

  return (
    <button
      onClick={() => setSyncEnabled(!syncEnabled)}
      className={`filter-chip ${syncEnabled ? 'active' : ''}`}
      aria-pressed={syncEnabled}
      title={tooltip}
      aria-label={tooltip}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        position: 'relative'
      }}
    >
      <RefreshCw size={14} className={syncEnabled ? 'animate-spin-slow' : ''} />
      {syncEnabled ? 'Sync On' : 'Sync Off'}
      {syncEnabled && (
        <span style={{
          position: 'absolute',
          top: '2px',
          right: '2px',
          width: '6px',
          height: '6px',
          background: 'var(--status-success)',
          borderRadius: '50%',
          boxShadow: '0 0 4px var(--status-success)'
        }} />
      )}
    </button>
  );
};

export default SyncToggle;
