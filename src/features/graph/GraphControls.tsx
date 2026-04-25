import React, { useState } from 'react';
import { Focus, Camera, Clock } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface GraphControlsProps {
  focusMode: boolean;
  setFocusMode: (focus: boolean) => void;
  hasSelection: boolean;
  selectedName?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  onSaveSnapshot?: (name: string, nodes: GraphNode[], edges: GraphEdge[]) => Promise<void>;
}

const GraphControls: React.FC<GraphControlsProps> = ({
  focusMode,
  setFocusMode,
  hasSelection,
  selectedName,
  nodes = [],
  edges = [],
  onSaveSnapshot,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim() || !onSaveSnapshot) return;
    await onSaveSnapshot(snapshotName, nodes, edges);
    setShowSaveModal(false);
    setSnapshotName('');
    setSnapshotDesc('');
  };

  return (
    <>
      <div className="viz-controls">
        <button
          onClick={() => setFocusMode(!focusMode)}
          className={focusMode ? 'active' : ''}
          disabled={!hasSelection}
          title={!hasSelection ? "Select a node first" : "Toggle Neighborhood Focus"}
        >
          <Focus size={16} /> {focusMode ? 'Show All' : 'Focus Neighborhood'}
        </button>
        {onSaveSnapshot && (
          <button
            onClick={() => setShowSaveModal(true)}
            title="Save Graph Snapshot"
          >
            <Camera size={16} /> Save Snapshot
          </button>
        )}
        {hasSelection && (
          <div className="selection-info">
            Selected: <strong>{selectedName}</strong>
          </div>
        )}
      </div>

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3><Camera size={16} /> Save Graph Snapshot</h3>
            <p className="modal-meta">
              <Clock size={14} /> {new Date().toLocaleString()} | {nodes.length} nodes, {edges.length} edges
            </p>
            <div className="form-group">
              <label htmlFor="snapshot-name">Snapshot Name *</label>
              <input
                id="snapshot-name"
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., Before restructuring"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="snapshot-desc">Description</label>
              <textarea
                id="snapshot-desc"
                value={snapshotDesc}
                onChange={(e) => setSnapshotDesc(e.target.value)}
                placeholder="Optional notes about this snapshot..."
                rows={2}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSaveSnapshot}
                disabled={!snapshotName.trim()}
                className="btn-primary"
              >
                <Camera size={14} /> Save Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GraphControls;
