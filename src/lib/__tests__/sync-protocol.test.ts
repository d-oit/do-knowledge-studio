import { describe, it, expect } from 'vitest';
import { createSyncSnapshot, mergeSnapshots } from '../sync/protocol';

const mockEntity = (id: string, name: string, updated?: string) => ({
  id, name, type: 'concept', description: `Desc for ${name}`,
  created_at: '2024-01-01', updated_at: updated ?? '2024-01-01',
});

const mockClaim = (id: string, entityId: string, statement: string) => ({
  id, entity_id: entityId, statement, confidence: 1,
  created_at: '2024-01-01', updated_at: '2024-01-01',
});

const mockLink = (sourceId: string, targetId: string, relation: string) => ({
  id: `${sourceId}-${targetId}`, source_id: sourceId, target_id: targetId, relation,
  created_at: '2024-01-01', updated_at: '2024-01-01',
});

describe('sync protocol', () => {
  describe('createSyncSnapshot', () => {
    it('creates a snapshot with all data', () => {
      const snapshot = createSyncSnapshot(
        [mockEntity('e1', 'React')],
        [mockClaim('c1', 'e1', 'Fast')],
        [],
        [],
        'device-1',
      );
      expect(snapshot.deviceId).toBe('device-1');
      expect(snapshot.entities).toHaveLength(1);
      expect(snapshot.claims).toHaveLength(1);
      expect(snapshot.timestamp).toBeDefined();
    });
  });

  describe('mergeSnapshots', () => {
    it('merges non-overlapping entities', () => {
      const local = createSyncSnapshot([mockEntity('e1', 'React')], [], [], [], 'local');
      const remote = createSyncSnapshot([mockEntity('e2', 'Vue')], [], [], [], 'remote');

      const { merged, conflicts } = mergeSnapshots(local, remote);
      expect(merged.entities).toHaveLength(2);
      expect(conflicts).toBe(0);
    });

    it('resolves conflicts by timestamp', () => {
      const local = createSyncSnapshot([mockEntity('e1', 'React', '2024-01-01')], [], [], [], 'local');
      const remote = createSyncSnapshot([mockEntity('e1', 'React Updated', '2024-06-01')], [], [], [], 'remote');

      const { merged, conflicts } = mergeSnapshots(local, remote);
      expect(merged.entities).toHaveLength(1);
      expect(merged.entities[0].name).toBe('React Updated');
      expect(conflicts).toBe(1);
    });

    it('keeps local when local is newer', () => {
      const local = createSyncSnapshot([mockEntity('e1', 'React New', '2024-06-01')], [], [], [], 'local');
      const remote = createSyncSnapshot([mockEntity('e1', 'React Old', '2024-01-01')], [], [], [], 'remote');

      const { merged } = mergeSnapshots(local, remote);
      expect(merged.entities[0].name).toBe('React New');
    });

    it('deduplicates claims by id', () => {
      const local = createSyncSnapshot([], [mockClaim('c1', 'e1', 'Same claim')], [], [], 'local');
      const remote = createSyncSnapshot([], [mockClaim('c1', 'e1', 'Same claim')], [], [], 'remote');

      const { merged } = mergeSnapshots(local, remote);
      expect(merged.claims).toHaveLength(1);
    });

    it('deduplicates links by source-target-relation', () => {
      const local = createSyncSnapshot([], [], [], [mockLink('e1', 'e2', 'uses')], 'local');
      const remote = createSyncSnapshot([], [], [], [mockLink('e1', 'e2', 'uses')], 'remote');

      const { merged } = mergeSnapshots(local, remote);
      expect(merged.links).toHaveLength(1);
    });

    it('keeps distinct links', () => {
      const local = createSyncSnapshot([], [], [], [mockLink('e1', 'e2', 'uses')], 'local');
      const remote = createSyncSnapshot([], [], [], [mockLink('e1', 'e2', 'relates_to')], 'remote');

      const { merged } = mergeSnapshots(local, remote);
      expect(merged.links).toHaveLength(2);
    });
  });
});
