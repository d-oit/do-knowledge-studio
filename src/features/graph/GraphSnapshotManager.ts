import { useState, useCallback } from 'react';
import { IRepository } from '../../db/repository';
import { logger } from '../../lib/logger';
import { validateSnapshotData } from './graph-schemas';

export function useGraphSnapshotManager(repository: IRepository) {
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [snapshotData, setSnapshotData] = useState<{
    nodes: { id: string; label: string }[];
    edges: { id: string; source: string; target: string; label?: string }[];
  } | null>(null);

  const handleSaveSnapshot = useCallback(async (
    name: string,
    nodes: { id: string; label: string }[],
    edges: { id: string; source: string; target: string; label?: string }[]
  ) => {
    try {
      await repository.createSnapshot(name, nodes, edges);
      logger.info(`Snapshot "${name}" saved successfully`);
    } catch (err) {
      logger.error('Failed to save snapshot', err);
    }
  }, [repository]);

  const handleLoadSnapshot = useCallback((
    nodes: { id: string; label: string }[],
    edges: { id: string; source: string; target: string; label?: string }[]
  ) => {
    const validated = validateSnapshotData({ nodes, edges });
    if (!validated) {
      logger.warn('Invalid snapshot data rejected', { nodeCount: nodes.length, edgeCount: edges.length });
      return;
    }
    setSnapshotData(validated);
    setSnapshotMode(true);
    logger.info(`Snapshot loaded with ${validated.nodes.length} nodes, ${validated.edges.length} edges`);
  }, []);

  const handleExitSnapshot = useCallback(() => {
    setSnapshotMode(false);
    setSnapshotData(null);
  }, []);

  return {
    snapshotMode,
    snapshotData,
    handleSaveSnapshot,
    handleLoadSnapshot,
    handleExitSnapshot,
    setSnapshotMode,
  };
}
