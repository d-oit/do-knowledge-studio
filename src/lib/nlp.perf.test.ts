import { describe, expect, it } from 'vitest'
import { parseIntent } from './nlp'

describe('parseIntent performance', () => {
  it('benchmarks parseIntent throughput', () => {
    const samples = [
      'Create a note called Project Architecture describing local store persistence tag: dev, async',
      'Search for quantum computing algorithms',
      'I believe that state hydration should be atomic and safe',
      'Jot down an idea about neural retrieval with #search and #ai tags',
      'Add a new person named Alice concerning front-end performance',
      'Random text with minimal meaning xyz qwr',
      'Create project Alpha for client deliverables',
    ]

    // Warmup
    for (let i = 0; i < 100; i++) {
      for (const sample of samples) {
        parseIntent(sample)
      }
    }

    const iterations = 10000
    const start = performance.now()
    for (let i = 0; i < iterations; i++) {
      for (const sample of samples) {
        parseIntent(sample)
      }
    }
    const duration = performance.now() - start
    const opsPerSec = (iterations * samples.length) / (duration / 1000)

    console.log(`--- BENCHMARK RESULTS ---`)
    console.log(`Total time for ${iterations * samples.length} parses: ${duration.toFixed(2)}ms`)
    console.log(`Throughput: ${Math.round(opsPerSec).toLocaleString()} ops/sec`)
    console.log(`-------------------------`)

    expect(duration).toBeGreaterThan(0)
  })
})
