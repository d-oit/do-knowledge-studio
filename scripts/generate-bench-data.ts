import { initDb } from '../src/db/client.js';
import { repository } from '../src/db/repository.js';
import { performance } from 'node:perf_hooks';

async function runBenchmark() {
  console.log('Initializing DB...');
  await initDb();

  const ENTITY_COUNT = 500;
  const LINK_COUNT = 1000;

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

    // Add a claim for each entity
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

  process.exit(0);
}

runBenchmark().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
