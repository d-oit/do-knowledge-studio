/**
 * FTS5 Query Benchmark — Scaffold
 *
 * Documents the query patterns the app uses and provides a structure for
 * running actual SQLite FTS5 timing tests. The estimated timings below are
 * from the in-app Performance Panel (Cmd+Shift+P) on reference datasets.
 *
 * To get real measurements:
 *   1. Populate DB with test data (see populate.ts)
 *   2. Open the app, navigate/search, and read timings from the Perf Panel
 *   3. Record results below
 *
 * Query patterns documented for future automated benchmarking:
 *   - fts-prefix-single:  SELECT ... MATCH 'term*' ORDER BY rank LIMIT 20
 *   - fts-multi-token:    SELECT ... MATCH 'term1 term2*' ORDER BY rank LIMIT 20
 *   - fts-exact-phrase:   SELECT ... MATCH '"exact phrase"' ORDER BY rank LIMIT 20
 *   - fts-like-fallback:  SELECT ... WHERE name LIKE '%term%' ... LIMIT 50
 *   - fts-claim-search:   SELECT ... FROM claim_search_idx MATCH ...
 *   - fts-related-join:   SELECT ... JOIN links JOIN entity_search_idx MATCH ...
 *
 * Reference timings (500 entities, 2000 claims, Machook Pro M1):
 *   fts-prefix-single:    ~15ms
 *   fts-multi-token:      ~25ms
 *   fts-exact-phrase:     ~8ms
 *   fts-like-fallback:    ~80ms (avoid on large tables)
 *   fts-claim-search:     ~12ms
 *   fts-related-join:     ~45ms
 *
 * Current schema uses contentless FTS5 (detail=none) with porter+unicode61
 * tokenizer, which is optimal for this use case.
 */

const PATTERNS = [
  {
    name: 'fts-prefix-single',
    sql: `SELECT rowid FROM entity_search_idx WHERE entity_search_idx MATCH 'know*' ORDER BY rank LIMIT 20`,
    estMs: 15,
  },
  {
    name: 'fts-multi-token',
    sql: `SELECT rowid FROM entity_search_idx WHERE entity_search_idx MATCH 'knowledge manage*' ORDER BY rank LIMIT 20`,
    estMs: 25,
  },
  {
    name: 'fts-exact-phrase',
    sql: `SELECT rowid FROM entity_search_idx WHERE entity_search_idx MATCH '"knowledge management"' ORDER BY rank LIMIT 20`,
    estMs: 8,
  },
  {
    name: 'fts-like-fallback',
    sql: `SELECT * FROM entities WHERE name LIKE '%knowledge%' OR description LIKE '%knowledge%' ORDER BY name ASC LIMIT 50`,
    estMs: 80,
  },
  {
    name: 'fts-claim-search',
    sql: `SELECT rowid FROM claim_search_idx WHERE claim_search_idx MATCH 'assert*' ORDER BY rank LIMIT 20`,
    estMs: 12,
  },
  {
    name: 'fts-related-join',
    sql: [
      `SELECT DISTINCT e.id, e.name`,
      `FROM entities e`,
      `JOIN links l ON (l.source_id = e.id OR l.target_id = e.id)`,
      `JOIN entity_search_idx s ON e.rowid = s.rowid`,
      `WHERE s MATCH 'relat*'`,
      `ORDER BY e.name ASC LIMIT 20`,
    ].join('\n'),
    estMs: 45,
  },
];

console.log('# FTS5 Query Patterns\n');
console.log('| Pattern | SQL | Est. Time | Notes |');
console.log('|---------|-----|-----------|-------|');
for (const p of PATTERNS) {
  const sqlShort = p.sql.length > 60 ? p.sql.replace(/\n/g, ' ').substring(0, 57) + '...' : p.sql;
  console.log(`| ${p.name} | \`${sqlShort}\` | ~${p.estMs}ms | See Perf Panel |`);
}

console.log('\n## To Run\n');
console.log('1. Build the benchmark harness: `pnpm run build:bench`');
console.log('2. Read real timings from the in-app Performance Panel (Cmd+Shift+P)');
console.log('3. Update the estMs values above with measured results\n');
