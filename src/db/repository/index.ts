import { RepositoryBase } from './base';
import { IRepository, RankedResult, GraphSnapshotDiff } from './types';
import * as entitiesSub from './entities';
import * as claimsSub from './claims';
import * as notesSub from './notes';
import * as linksSub from './links';
import * as snapshotsSub from './graph-snapshots';
import * as webCacheSub from './web-cache';
import { Entity, Claim, Note, Link, GraphSnapshot } from '../../lib/validation';

export type { IRepository, RankedResult, GraphSnapshotDiff };

export class Repository extends RepositoryBase implements IRepository {
  // --- Entities ---
  async createEntity(entity: Omit<Entity, 'id' | 'created_at' | 'updated_at'>): Promise<Entity & { rowid: number }> {
    return entitiesSub.createEntity(this, entity);
  }
  async getAllEntities(options?: { limit?: number; offset?: number }): Promise<Entity[]> {
    return entitiesSub.getAllEntities(this, options);
  }
  async getEntities(options?: Parameters<IRepository['getEntities']>[0]): Promise<Entity[]> {
    return entitiesSub.getEntities(this, options);
  }
  async getEntitiesCount(options?: Parameters<IRepository['getEntitiesCount']>[0]): Promise<number> {
    return entitiesSub.getEntitiesCount(this, options);
  }
  async getEntityById(id: string): Promise<(Entity & { rowid: number }) | null> {
    return entitiesSub.getEntityById(this, id);
  }
  async getEntityByName(name: string): Promise<Entity | null> {
    return entitiesSub.getEntityByName(this, name);
  }
  async updateEntity(id: string, entity: Partial<Entity>): Promise<Entity> {
    return entitiesSub.updateEntity(this, id, entity);
  }
  async deleteEntity(id: string): Promise<void> {
    return entitiesSub.deleteEntity(this, id);
  }
  async searchEntities(query: string): Promise<Entity[]> {
    return entitiesSub.searchEntities(this, query);
  }
  async searchRelated(query: string, options?: { excludeIds?: Set<string> }): Promise<RankedResult[]> {
    return entitiesSub.searchRelated(this, query, options);
  }

  // --- Claims ---
  async createClaim(claim: Parameters<IRepository['createClaim']>[0]): Promise<Claim & { rowid: number }> {
    return claimsSub.createClaim(this, claim);
  }
  async createClaimWithProvenance(claim: Parameters<IRepository['createClaimWithProvenance']>[0]): Promise<Claim> {
    return claimsSub.createClaim(this, claim);
  }
  async getClaimsByVerificationStatus(status: Claim['verification_status']): Promise<Claim[]> {
    return claimsSub.getClaimsByVerificationStatus(this, status);
  }
  async getClaimStageMap(claimIds: string[]): Promise<Map<string, string>> {
    return claimsSub.getClaimStageMap(this, claimIds);
  }
  async updateClaimVerification(claimId: string, verification_status: Claim['verification_status']): Promise<Claim> {
    return claimsSub.updateClaimVerification(this, claimId, verification_status);
  }
  async getClaimsByEntityId(entity_id: string): Promise<(Claim & { rowid: number })[]> {
    return claimsSub.getClaimsByEntityId(this, entity_id);
  }
  async getAllClaims(): Promise<Claim[]> {
    return claimsSub.getAllClaims(this);
  }
  async getAllClaimsGroupedByEntity(): Promise<Record<string, Claim[]>> {
    const claims = await this.getAllClaims();
    return claims.reduce((acc, claim) => {
      if (!acc[claim.entity_id]) acc[claim.entity_id] = [];
      acc[claim.entity_id].push(claim);
      return acc;
    }, {} as Record<string, Claim[]>);
  }
  async getAllEntitiesWithClaims(): Promise<Map<string, { entity: Entity; claims: Claim[] }>> {
    return claimsSub.getAllEntitiesWithClaims(this);
  }
  async updateClaim(id: string, claim: Partial<Claim>): Promise<Claim> {
    return claimsSub.updateClaim(this, id, claim);
  }
  async deleteClaim(id: string): Promise<void> {
    return claimsSub.deleteClaim(this, id);
  }

  // --- Notes ---
  async createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    return notesSub.createNote(this, note);
  }
  async getAllNotes(): Promise<Note[]> {
    return notesSub.getAllNotes(this);
  }
  async getNotesByEntityId(entity_id: string): Promise<Note[]> {
    return notesSub.getNotesByEntityId(this, entity_id);
  }
  async getAllNotesGroupedByEntity(): Promise<Record<string, Note[]>> {
    const notes = await this.getAllNotes();
    return notes.reduce((acc, note) => {
      if (!note.entity_id) return acc;
      if (!acc[note.entity_id]) acc[note.entity_id] = [];
      acc[note.entity_id].push(note);
      return acc;
    }, {} as Record<string, Note[]>);
  }
  async updateNote(id: string, note: Partial<Note>): Promise<Note> {
    return notesSub.updateNote(this, id, note);
  }
  async deleteNote(id: string): Promise<void> {
    return notesSub.deleteNote(this, id);
  }

  // --- Links ---
  async createLink(link: Omit<Link, 'id' | 'created_at' | 'updated_at'>): Promise<Link> {
    return linksSub.createLink(this, link);
  }
  async getAllLinks(options?: { limit?: number; offset?: number }): Promise<Link[]> {
    return linksSub.getAllLinks(this, options);
  }
  async deleteLink(id: string): Promise<void> {
    return linksSub.deleteLink(this, id);
  }
  async getBacklinks(entityId: string): Promise<Entity[]> {
    return linksSub.getBacklinks(this, entityId);
  }
  async getBacklinkCount(entityId: string): Promise<number> {
    return linksSub.getBacklinkCount(this, entityId);
  }

  // --- Web Cache ---
  async upsertWebCache(url: string, content: string, title?: string, format: 'markdown' | 'plain' = 'plain'): Promise<void> {
    return webCacheSub.upsertWebCache(this, url, content, title, format);
  }
  async getWebCache(url: string): Promise<{ url: string; content: string; format: string; title?: string; resolved_at: string } | null> {
    return webCacheSub.getWebCache(this, url);
  }

  // --- Graph Snapshots ---
  async createSnapshot(
    name: string,
    nodes: { id: string; label: string }[],
    edges: { id: string; source: string; target: string; label?: string }[],
    description?: string,
  ): Promise<GraphSnapshot> {
    return snapshotsSub.createSnapshot(this, name, nodes, edges, description);
  }
  async getSnapshot(id: string): Promise<GraphSnapshot | null> {
    return snapshotsSub.getSnapshot(this, id);
  }
  async listSnapshots(): Promise<GraphSnapshot[]> {
    return snapshotsSub.listSnapshots(this);
  }
  async diffSnapshots(id1: string, id2: string): Promise<GraphSnapshotDiff> {
    return snapshotsSub.diffSnapshots(this, id1, id2);
  }
}

/** Singleton repository instance for the application. */
export const repository = new Repository();
