import React from 'react';
import { Focus } from 'lucide-react';

interface GraphControlsProps {
  focusMode: boolean;
  setFocusMode: (focus: boolean) => void;
  hasSelection: boolean;
  selectedName?: string;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  focusMode,
  setFocusMode,
  hasSelection,
  selectedName
}) => {
  return (
    <div className="viz-controls">
      <button
        onClick={() => setFocusMode(!focusMode)}
        className={focusMode ? 'active' : ''}
        disabled={!hasSelection}
        title={!hasSelection ? "Select a node first" : "Toggle Neighborhood Focus"}
      >
        <Focus size={16} /> {focusMode ? 'Show All' : 'Focus Neighborhood'}
      </button>
      {hasSelection && (
        <div className="selection-info">
          Selected: <strong>{selectedName}</strong>
        </div>
      )}
    </div>
  );
};
