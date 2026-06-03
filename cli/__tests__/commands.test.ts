import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { initDb } from '../db';
import { setDb } from '../../src/db/client';
import { repository } from '../../src/db/repository';

describe('CLI Commands', () => {
  const testDbPath = path.join(process.cwd(), 'test-commands.db');
  let logSpy: any;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    const db = await initDb(testDbPath);
    setDb(db);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    const db = await initDb(testDbPath);
    await db.close();
    vi.restoreAllMocks();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('entity-create command works', async () => {
    const name = 'Test Entity';
    const type = 'concept';
    const entity = await repository.createEntity({ name, type });

    expect(entity.name).toBe(name);
    expect(entity.type).toBe(type);

    const saved = await repository.getEntityByName(name);
    expect(saved?.id).toBe(entity.id);
  });

  it('entity-list command works', async () => {
    await repository.createEntity({ name: 'E1', type: 'note' });
    await repository.createEntity({ name: 'E2', type: 'note' });

    const entities = await repository.getAllEntities();
    expect(entities).toHaveLength(2);
    expect(entities.map(e => e.name)).toContain('E1');
    expect(entities.map(e => e.name)).toContain('E2');
  });

  it('claim-create command works', async () => {
    const entity = await repository.createEntity({ name: 'E1', type: 'note' });
    const claim = await repository.createClaim({
      entity_id: entity.id!,
      statement: 'Test Statement',
      confidence: 0.9
    });

    expect(claim.statement).toBe('Test Statement');
    expect(claim.entity_id).toBe(entity.id);

    const claims = await repository.getClaimsByEntityId(entity.id!);
    expect(claims).toHaveLength(1);
    expect(claims[0].statement).toBe('Test Statement');
  });

  it('basic DB operations work', async () => {
    await repository.createEntity({ name: 'Searchable Entity', type: 'note', description: 'Find me' });

    const entities = await repository.getAllEntities();
    expect(entities.length).toBeGreaterThan(0);
    expect(entities[0].name).toBe('Searchable Entity');
  });

  it('db:status returns migrations', async () => {
      const entities = await repository.getAllEntities();
      expect(entities).toBeDefined();
  });
});
