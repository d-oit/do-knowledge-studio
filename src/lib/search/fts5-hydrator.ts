import { repository } from '../../db/repository';
import { perf } from '../perf';

export async function hydrateFts5Index() {
  perf.mark('fts-rebuild-start');
  await repository.exec({ sql: 'DELETE FROM entity_search_idx', bind: [] });
  await repository.exec({ sql: 'DELETE FROM claim_search_idx', bind: [] });
  await repository.exec({
    sql: `INSERT INTO entity_search_idx(rowid, name, description) SELECT rowid, name, description FROM entities`,
    bind: [],
  });
  await repository.exec({
    sql: `INSERT INTO claim_search_idx(rowid, statement) SELECT rowid, statement FROM claims`,
    bind: [],
  });
  perf.measure('fts-rebuild', 'fts-rebuild-start');
}
