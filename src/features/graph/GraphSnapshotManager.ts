import { useState, useCallback } from 'react';
import { IRepository } from '../../db/repository';
import { logger } from '../../lib/logger';

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
    setSnapshotData({ nodes, edges });
    setSnapshotMode(true);
    logger.info(`Snapshot loaded with ${nodes.length} nodes, ${edges.length} edges`);
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
