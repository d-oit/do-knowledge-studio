import React, { useState, useRef, useEffect } from 'react';
import { Focus, Camera, Clock, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA_QUERIES } from '../../lib/constants';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery(MEDIA_QUERIES.MOBILE);

  const snapshotNameRef = useRef<HTMLInputElement>(null);

  useFocusTrap(modalRef, showSaveModal);
  useEscapeKey(() => setShowSaveModal(false), showSaveModal);

  useEffect(() => {
    if (showSaveModal && snapshotNameRef.current) {
      snapshotNameRef.current.focus();
    }
  }, [showSaveModal]);

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim() || !onSaveSnapshot) return;
    await onSaveSnapshot(snapshotName, nodes, edges);
    setShowSaveModal(false);
    setSnapshotName('');
    setSnapshotDesc('');
  };

  const controls = (
    <div className={isMobile ? "viz-controls-mobile" : "viz-controls"}>
      <button
        onClick={() => setFocusMode(!focusMode)}
        className={focusMode ? 'active' : ''}
        disabled={!hasSelection}
        aria-pressed={focusMode}
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
      {hasSelection && !isMobile && (
        <div className="selection-info">
          Selected: <strong>{selectedName}</strong>
        </div>
      )}
    </div>
  );

  return (
    <>
      {controls}

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div
            ref={modalRef}
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="inspector-header" style={{ marginBottom: 'var(--space-4)', padding: 0, background: 'transparent', border: 0 }}>
              <h3 id="modal-title"><Camera size={18} /> Save Graph Snapshot</h3>
              <button className="close-button" onClick={() => setShowSaveModal(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <p className="modal-meta" style={{ marginBottom: 'var(--space-4)', fontSize: '13px', color: 'var(--text-muted)' }}>
              <Clock size={14} /> {new Date().toLocaleString()} | {nodes.length} nodes, {edges.length} edges
            </p>

            <div className="form-group">
              <label htmlFor="snapshot-name">Snapshot Name *</label>
              <input
                id="snapshot-name"
                ref={snapshotNameRef}
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., Before restructuring"
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
                style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-base)', border: '1px solid var(--border-default)' }}
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
