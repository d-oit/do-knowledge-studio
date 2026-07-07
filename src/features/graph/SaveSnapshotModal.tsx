import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Clock } from 'lucide-react';
import Overlay from '../../components/Overlay';

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

interface SaveSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSave: (name: string, nodes: GraphNode[], edges: GraphEdge[]) => Promise<void>;
}

const SaveSnapshotModal: React.FC<SaveSnapshotModalProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  onSave,
}) => {
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const snapshotNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && snapshotNameRef.current) {
      snapshotNameRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!snapshotName.trim()) return;
    await onSave(snapshotName, nodes, edges);
    onClose();
    setSnapshotName('');
    setSnapshotDesc('');
  };

  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      variant="center"
      ariaLabel="Save Graph Snapshot"
    >
      <div className="modal-header">
        <h3 id="modal-title"><Camera size={18} /> Save Graph Snapshot</h3>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>
      </div>

      <div className="modal-body">
        <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--size-base)', color: 'var(--text-muted)' }}>
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
          />
        </div>
      </div>

      <div className="modal-actions">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={!snapshotName.trim()}
          className="btn-primary"
        >
          <Camera size={14} /> Save Snapshot
        </button>
      </div>
    </Overlay>
  );
};

export default SaveSnapshotModal;
