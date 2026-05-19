import { initDb } from '../src/db/client.js';
import { repository } from '../src/db/repository.js';
import { performance } from 'node:perf_hooks';
import * as fs from 'node:fs';

async function runBenchmark() {
  console.log('Initializing DB...');
  // We need to simulate the environment for initDb to work in Node
  // without trying to fetch /db/schema.sql

  await initDb();

  const ENTITY_COUNT = 100; // Reduced for baseline if it's slow
  const LINK_COUNT = 200;

  console.log(`Generating ${ENTITY_COUNT} entities and ${LINK_COUNT} links...`);

  const start = performance.now();
  const entityIds: string[] = [];

  for (let i = 0; i < ENTITY_COUNT; i++) {
    const entity = await repository.createEntity({
      name: `Benchmark Entity ${i}`,
      type: 'concept',
      description: `This is a long description for benchmark entity ${i} to test FTS5 indexing performance. It contains some keywords like TRIZ, knowledge, and studio.`,
      metadata: { index: i }
    });
    entityIds.push(entity.id!);

    await repository.createClaim({
      entity_id: entity.id!,
      statement: `Assertion about entity ${i}: it is highly relevant for performance testing.`,
      confidence: 0.9,
      source: 'benchmark'
    });
  }

  for (let i = 0; i < LINK_COUNT; i++) {
    const sourceIdx = Math.floor(Math.random() * ENTITY_COUNT);
    const targetIdx = Math.floor(Math.random() * ENTITY_COUNT);
    if (sourceIdx !== targetIdx) {
      await repository.createLink({
        source_id: entityIds[sourceIdx],
        target_id: entityIds[targetIdx],
        relation: 'related_to'
      });
    }
  }

  const end = performance.now();
  const duration = end - start;

  console.log(`Benchmark data generation took ${duration.toFixed(2)}ms`);

  // Measure search performance
  const searchStart = performance.now();
  const results = await repository.searchEntities('TRIZ');
  const searchEnd = performance.now();
  console.log(`Search for 'TRIZ' took ${(searchEnd - searchStart).toFixed(2)}ms and found ${results.length} results.`);

  const report = `# Performance Benchmark Results

## Baseline (Pre-optimization)
- Date: ${new Date().toISOString()}
- Entities: ${ENTITY_COUNT}
- Claims: ${ENTITY_COUNT}
- Links: ${LINK_COUNT}
- Data Generation Time: ${duration.toFixed(2)}ms
- Search Time ('TRIZ'): ${(searchEnd - searchStart).toFixed(2)}ms
- Results Found: ${results.length}
`;

  fs.writeFileSync('plans/perf-benchmarks.md', report);
  console.log('Report written to plans/perf-benchmarks.md');

  process.exit(0);
}

runBenchmark().catch(err => {
  console.error(err);
  process.exit(1);
});
