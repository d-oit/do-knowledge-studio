import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Clock } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const snapshotNameRef = useRef<HTMLInputElement>(null);

  useFocusTrap(modalRef, isOpen);
  useEscapeKey(onClose, isOpen);

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

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="inspector-header" style={{ marginBottom: 'var(--space-4)', padding: 0, background: 'transparent', border: 0 }}>
          <h3 id="modal-title"><Camera size={18} /> Save Graph Snapshot</h3>
          <button className="close-button" onClick={onClose} aria-label="Close modal">
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
      </div>
    </div>
  );
};

export default SaveSnapshotModal;
