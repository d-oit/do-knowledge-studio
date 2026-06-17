import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useGraphSyncStore } from '../store/graph-sync-store';

interface SyncToggleProps {
  tooltip?: string;
}

const SyncToggle: React.FC<SyncToggleProps> = ({
  tooltip = 'Sync mind map with knowledge graph',
}) => {
  const { syncEnabled, setSyncEnabled } = useGraphSyncStore();

  return (
    <button
      type="button"
      onClick={() => setSyncEnabled(!syncEnabled)}
      className={`filter-chip sync-toggle ${syncEnabled ? 'active' : ''}`}
      aria-pressed={syncEnabled}
      aria-label={`${syncEnabled ? 'Disable' : 'Enable'} graph sync`}
      title={tooltip}
    >
      <RefreshCw
        size={14}
        className={syncEnabled ? 'sync-icon-on' : 'sync-icon-off'}
        aria-hidden="true"
      />
      <span className="sync-toggle-label">
        {syncEnabled ? 'Sync on' : 'Sync off'}
      </span>
      {syncEnabled && (
        <span className="sync-indicator-dot" aria-hidden="true" />
      )}
    </button>
  );
};

export default SyncToggle;
