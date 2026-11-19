/**
 * Deterministic large-graph corpus fixture for performance benchmarks (#1163).
 *
 * The same corpus is used by the vitest graph-filter benches and, via the
 * E2E store fixture, by the browser frame-timeline sweeps. A fixed seed and a
 * tiny PRNG make every run byte-identical, so budget comparisons across runs
 * and machines measure the same graph.
 */
import type { Claim, Entity } from './types'

/** Sizes the graph benches exercise, in nodes. */
export const BENCH_GRAPH_SIZES = [1000, 5000, 10000] as const

/** Entity types spread across the corpus, mirroring the app's built-ins. */
const TYPE_POOL = ['note', 'concept', 'person', 'project'] as const

/** Tag pool sized so tag conditions narrow meaningfully without being unique. */
const TAG_POOL = [
  'triz',
  'innovation',
  'method',
  'pkm',
  'search',
  'ai',
  'history',
  'reflection',
  'architecture',
  'knowledge',
] as const

/** Deterministic PRNG (mulberry32); state is an integer seed. */
const mulberry32 = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const pick = <T>(rand: () => number, pool: readonly T[]): T =>
  pool[Math.floor(rand() * pool.length)]!

export interface BenchGraphFixture {
  entities: Entity[]
  claims: Claim[]
}

/**
 * Builds a corpus of `total` entities with ring + shortcut links (average
 * degree ≈ 2.25) and ~1.5 claims per entity. `seed` defaults to a fixed
 * constant so the corpus is reproducible; pass a different seed to get a
 * different but still deterministic graph.
 */
export const buildBenchGraph = (total: number, seed = 0xc0ffee): BenchGraphFixture => {
  const rand = mulberry32(seed)
  const entities: Entity[] = Array.from({ length: total }, (_, index) => {
    const id = `bench-${String(index).padStart(6, '0')}`
    const tags = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(rand, TAG_POOL))
    const links = []
    // Every entity links to its successor; a quarter add a random shortcut.
    links.push({ targetId: `bench-${String((index + 1) % total).padStart(6, '0')}`, relation: 'linked' })
    if (rand() < 0.25) {
      links.push({
        targetId: `bench-${String(Math.floor(rand() * total)).padStart(6, '0')}`,
        relation: 'related',
      })
    }
    return {
      id,
      name: `Benchmark Entity ${index}`,
      type: pick(rand, TYPE_POOL),
      description: `A generated entity used only by graph benchmarks (${id}).`,
      content: `# ${id}\n\nGenerated corpus content for deterministic large-graph benchmarking.`,
      tags: [...new Set(tags)],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      links,
    }
  })

  const claims: Claim[] = []
  let claimIndex = 0
  for (const entity of entities) {
    const claimCount = 1 + (rand() < 0.5 ? 1 : 0)
    for (let c = 0; c < claimCount; c += 1) {
      const confidence = Math.round((0.3 + rand() * 0.7) * 20) / 20
      const verificationRoll = rand()
      const verification =
        verificationRoll < 0.4 ? 'verified' : verificationRoll < 0.9 ? 'unverified' : 'disputed'
      claims.push({
        id: `bench-c-${String(claimIndex).padStart(7, '0')}`,
        entityId: entity.id,
        statement: `Generated claim ${claimIndex} for ${entity.name}.`,
        confidence,
        verification,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      })
      claimIndex += 1
    }
  }

  return { entities, claims }
}
