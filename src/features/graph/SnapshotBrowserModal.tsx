import React, { useState, useRef, useEffect } from 'react';
import { X, FolderOpen, GitCompare, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import type { GraphSnapshot } from '../../lib/validation';
import type { GraphSnapshotDiff } from '../../db/repository';
import { GraphNodeSchema, GraphEdgeSchema } from './graph-schemas';
import { z } from 'zod';

interface SnapshotBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSnapshot: (nodes: { id: string; label: string }[], edges: { id: string; source: string; target: string; label?: string }[]) => void;
  onSnapshotModeChange: (active: boolean) => void;
}

const SnapshotBrowserModal: React.FC<SnapshotBrowserModalProps> = ({
  isOpen,
  onClose,
  onLoadSnapshot,
  onSnapshotModeChange,
}) => {
  const repository = useRepository();
  const snapshotBrowserRef = useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [selectedForDiff, setSelectedForDiff] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<GraphSnapshotDiff | null>(null);
  const [loadingSnapshotId, setLoadingSnapshotId] = useState<string | null>(null);

  useFocusTrap(snapshotBrowserRef, isOpen);
  useEscapeKey(() => { onClose(); setDiffResult(null); }, isOpen);

  useEffect(() => {
    if (isOpen) {
      const loadSnapshots = async () => {
        setIsLoadingSnapshots(true);
        try {
          const list = await repository.listSnapshots();
          setSnapshots(list);
        } catch (err) {
          logger.error('Failed to load snapshots', { error: err });
        } finally {
          setIsLoadingSnapshots(false);
        }
      };
      void loadSnapshots();
    }
  }, [isOpen, repository]);

  const handleLoadSnapshot = async (snapshotId: string) => {
    setLoadingSnapshotId(snapshotId);
    try {
      const snap = await repository.getSnapshot(snapshotId);
      if (!snap) return;
      const nodesResult = z.array(GraphNodeSchema).safeParse(JSON.parse(snap.nodes_json));
      const edgesResult = z.array(GraphEdgeSchema).safeParse(JSON.parse(snap.edges_json));

      if (!nodesResult.success || !edgesResult.success) {
        logger.error('Snapshot data validation failed', {
          nodesError: nodesResult.success ? null : nodesResult.error.message,
          edgesError: edgesResult.success ? null : edgesResult.error.message,
        });
        return;
      }

      const loadedNodes = nodesResult.data;
      const loadedEdges = edgesResult.data;
      onLoadSnapshot(loadedNodes, loadedEdges);
      onSnapshotModeChange(true);
      onClose();
      logger.info(`Loaded snapshot: ${snap.name}`);
    } catch (err) {
      logger.error('Failed to load snapshot', { error: err });
    } finally {
      setLoadingSnapshotId(null);
    }
  };

  const handleToggleDiffSelect = (id: string) => {
    setSelectedForDiff(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleDiff = async () => {
    if (selectedForDiff.length !== 2) return;
    try {
      const result = await repository.diffSnapshots(selectedForDiff[0], selectedForDiff[1]);
      setDiffResult(result);
    } catch (err) {
      logger.error('Failed to diff snapshots', { error: err });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setDiffResult(null); } }}
      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Escape') { onClose(); setDiffResult(null); } }}
    >
      <div
        ref={snapshotBrowserRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-browser-title"
        style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="inspector-header" style={{ marginBottom: 'var(--space-4)', padding: 0, background: 'transparent', border: 0 }}>
          <h3 id="snapshot-browser-title"><FolderOpen size={18} /> Graph Snapshots</h3>
          <button className="close-button" onClick={() => { onClose(); setDiffResult(null); }} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {isLoadingSnapshots ? (
          <p style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>Loading snapshots...</p>
        ) : snapshots.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>No snapshots saved yet. Use Save Snapshot to create one.</p>
        ) : (
          <>
            <p style={{ marginBottom: 'var(--space-3)', fontSize: '13px', color: 'var(--text-muted)' }}>
              Click a snapshot to load it. Select two and click Compare to see differences.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 'var(--space-3)' }}>
              {snapshots.map(snap => {
                if (!snap.id) return null;
                const isSelected = selectedForDiff.includes(snap.id);
                return (
                  <button
                    key={snap.id}
                    type="button"
                    onClick={() => { handleToggleDiffSelect(snap.id); }}
                    onDoubleClick={() => void handleLoadSnapshot(snap.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      border: isSelected ? '2px solid var(--interactive-primary)' : '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-base)',
                      background: isSelected ? 'var(--interactive-primary-subtle)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '28px', fontWeight: isSelected ? 'bold' : 'normal' }}>
                      {isSelected ? (selectedForDiff.indexOf(snap.id) + 1) : ''}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{snap.name}</div>
                      {snap.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{snap.description}</div>}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {new Date(snap.created_at).toLocaleString()}
                      </div>
                    </div>
                    {loadingSnapshotId === snap.id && <Loader2 size={14} className="animate-spin" />}
                  </button>
                );
              })}
            </div>

            <div className="modal-actions" style={{ marginBottom: 'var(--space-3)' }}>
              <button
                onClick={() => void handleDiff()}
                disabled={selectedForDiff.length !== 2}
                className="btn-primary"
              >
                <GitCompare size={14} /> Compare Selected
              </button>
            </div>

            {diffResult && (
              <div style={{
                padding: 'var(--space-3)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-base)',
                border: '1px solid var(--border-default)',
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Diff Results</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <div style={{ color: 'var(--status-success)', fontWeight: 600, marginBottom: '4px' }}>
                      + Added Nodes ({diffResult.added_nodes.length})
                    </div>
                    {diffResult.added_nodes.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>None</span>
                    ) : (
                      diffResult.added_nodes.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                    )}
                  </div>
                  <div>
                    <div style={{ color: 'var(--status-danger)', fontWeight: 600, marginBottom: '4px' }}>
                      - Removed Nodes ({diffResult.removed_nodes.length})
                    </div>
                    {diffResult.removed_nodes.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>None</span>
                    ) : (
                      diffResult.removed_nodes.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                    )}
                  </div>
                  <div>
                    <div style={{ color: 'var(--status-success)', fontWeight: 600, marginBottom: '4px' }}>
                      + Added Edges ({diffResult.added_edges.length})
                    </div>
                    {diffResult.added_edges.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>None</span>
                    ) : (
                      diffResult.added_edges.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                    )}
                  </div>
                  <div>
                    <div style={{ color: 'var(--status-danger)', fontWeight: 600, marginBottom: '4px' }}>
                      - Removed Edges ({diffResult.removed_edges.length})
                    </div>
                    {diffResult.removed_edges.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>None</span>
                    ) : (
                      diffResult.removed_edges.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SnapshotBrowserModal;
