import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH_FILTER, evaluateGraphQuery, filterGraph } from './graph-query'
import { EMPTY_GRAPH_QUERY, addQueryCondition, addQueryGroup, setQueryConditionValue } from './graph-query-builder'
import { BENCH_GRAPH_SIZES, buildBenchGraph } from './graph-bench-fixture'

/**
 * Graph filter/query CPU budgets (#1163). Each entry is the milliseconds
 * allowed to evaluate one corpus-wide query at that size — a hard knob on
 * the main thread, measured in Node on the CI runner. Numbers and method are
 * recorded in `plans/perf-baselines.md`.
 */
const FILTER_BUDGETS_MS: Record<number, number> = {
  1000: 25,
  5000: 120,
  10000: 250,
}

const QUERY_BUDGETS_MS: Record<number, number> = {
  1000: 25,
  5000: 150,
  10000: 300,
}

/** A representative nested query: (type:person AND (tag:triz OR verified)). */
const buildNestedQuery = () => {
  let query = addQueryCondition(EMPTY_GRAPH_QUERY, [], 'entityType')
  query = setQueryConditionValue(query, [0], 'person')
  query = addQueryGroup(query, [], 'or')
  query = addQueryCondition(query, [1], 'tag')
  query = setQueryConditionValue(query, [1, 0], 'triz')
  query = addQueryCondition(query, [1], 'claimStatus')
  query = setQueryConditionValue(query, [1, 1], 'verified')
  return query
}

describe('graph filter benchmark', () => {
  it.each(BENCH_GRAPH_SIZES)(
    'filterGraph evaluates $nodes nodes within the ceiling',
    (nodes) => {
      const { entities, claims } = buildBenchGraph(nodes)
      const filter = { ...EMPTY_GRAPH_FILTER, types: ['person'], verifiedOnly: true }

      // One warm-up pass so the measurement is not dominated by JIT.
      filterGraph(entities, claims, filter)

      const start = performance.now()
      const result = filterGraph(entities, claims, filter)
      const duration = performance.now() - start

      expect(result.entities.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(FILTER_BUDGETS_MS[nodes] ?? 1000)
    },
    30_000,
  )

  it.each(BENCH_GRAPH_SIZES)(
    'evaluateGraphQuery evaluates a nested $nodes-node query within the ceiling',
    (nodes) => {
      const { entities, claims } = buildBenchGraph(nodes)
      const query = buildNestedQuery()

      evaluateGraphQuery(entities, claims, query)

      const start = performance.now()
      const result = evaluateGraphQuery(entities, claims, query)
      const duration = performance.now() - start

      expect(result.entities.length).toBeGreaterThan(0)
      expect(result.edges.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(QUERY_BUDGETS_MS[nodes] ?? 1000)
    },
    30_000,
  )
})
