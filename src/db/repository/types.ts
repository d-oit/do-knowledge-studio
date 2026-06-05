import {
  Entity,
  Claim,
  Note,
  Link,
  GraphSnapshot,
} from '../../lib/validation';
import { SQLiteDB } from '../client';

export interface RankedResult {
  id: string;
  title: string;
  type: string;
  content: string;
  score: number;
  stage: string;
}

export interface GraphSnapshotDiff {
  added_nodes: string[];
  removed_nodes: string[];
  added_edges: string[];
  removed_edges: string[];
}

export interface IRepository {
  // --- Core ---
  exec<T = unknown>(options: Parameters<SQLiteDB['exec']>[0]): Promise<T>;
  transaction<T = unknown>(statements: Parameters<SQLiteDB['transaction']>[0]): Promise<T>;

  // --- Entities ---
  createEntity(entity: Omit<Entity, 'id' | 'created_at' | 'updated_at'>): Promise<Entity & { rowid: number }>;
  getAllEntities(options?: { limit?: number; offset?: number }): Promise<Entity[]>;
  getEntities(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'created_at' | 'updated_at';
    sortOrder?: 'ASC' | 'DESC';
    type?: string;
    search?: string;
  }): Promise<Entity[]>;
  getEntitiesCount(options?: { type?: string; search?: string }): Promise<number>;
  getEntityById(id: string): Promise<(Entity & { rowid: number }) | null>;
  getEntityByName(name: string): Promise<Entity | null>;
  updateEntity(id: string, entity: Partial<Entity>): Promise<Entity>;
  deleteEntity(id: string): Promise<void>;
  searchEntities(query: string): Promise<Entity[]>;
  searchRelated(query: string, options?: { excludeIds?: Set<string> }): Promise<RankedResult[]>;

  // --- Claims ---
  createClaim(
    claim: Omit<Claim, 'id' | 'created_at' | 'updated_at' | 'verification_status'> & {
      verification_status?: Claim['verification_status'];
    },
  ): Promise<Claim & { rowid: number }>;
  createClaimWithProvenance(
    claim: Omit<Claim, 'id' | 'created_at' | 'updated_at' | 'verification_status'> & {
      verification_status?: Claim['verification_status'];
    },
  ): Promise<Claim>;
  getClaimsByVerificationStatus(status: Claim['verification_status']): Promise<Claim[]>;
  getClaimStageMap(claimIds: string[]): Promise<Map<string, string>>;
  updateClaimVerification(claimId: string, verification_status: Claim['verification_status']): Promise<Claim>;
  getClaimsByEntityId(entity_id: string): Promise<(Claim & { rowid: number })[]>;
  getAllClaims(): Promise<Claim[]>;
  getAllClaimsGroupedByEntity(): Promise<Record<string, Claim[]>>;
  getAllEntitiesWithClaims(): Promise<Map<string, { entity: Entity; claims: Claim[] }>>;
  updateClaim(id: string, claim: Partial<Claim>): Promise<Claim>;
  deleteClaim(id: string): Promise<void>;

  // --- Notes ---
  createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note>;
  getAllNotes(): Promise<Note[]>;
  getNotesByEntityId(entity_id: string): Promise<Note[]>;
  getAllNotesGroupedByEntity(): Promise<Record<string, Note[]>>;
  updateNote(id: string, note: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;

  // --- Links ---
  createLink(link: Omit<Link, 'id' | 'created_at' | 'updated_at'>): Promise<Link>;
  getAllLinks(options?: { limit?: number; offset?: number }): Promise<Link[]>;
  deleteLink(id: string): Promise<void>;
  getBacklinks(entityId: string): Promise<Entity[]>;
  getBacklinkCount(entityId: string): Promise<number>;

  // --- Web Cache ---
  upsertWebCache(url: string, content: string, title?: string, format?: 'markdown' | 'plain'): Promise<void>;
  getWebCache(url: string): Promise<{ url: string; content: string; format: string; title?: string; resolved_at: string } | null>;

  // --- Graph Snapshots ---
  createSnapshot(
    name: string,
    nodes: { id: string; label: string }[],
    edges: { id: string; source: string; target: string; label?: string }[],
    description?: string,
  ): Promise<GraphSnapshot>;
  getSnapshot(id: string): Promise<GraphSnapshot | null>;
  listSnapshots(): Promise<GraphSnapshot[]>;
  diffSnapshots(id1: string, id2: string): Promise<GraphSnapshotDiff>;
}
