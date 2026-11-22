import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { getPropertyTestParameters, getPropertyTestTimeoutMs } from '@/test/property-test-config'
import type { Claim, Entity } from './types'
import {
  EMPTY_GRAPH_FILTER,
  evaluateGraphQuery,
  filterGraph,
  undirectedEdgeKey,
  type FilteredGraph,
} from './graph-query'
import {
  EMPTY_GRAPH_QUERY,
  GraphQuerySchema,
  MAX_QUERY_CLAUSES,
  MAX_QUERY_DEPTH,
  MAX_QUERY_VALUE_LENGTH,
  addQueryCondition,
  addQueryGroup,
  isGraphQueryEmpty,
  removeQueryClause,
  serializeGraphQuery,
  setQueryClauseExclude,
  setQueryConditionValue,
  setQueryGroupOperator,
  summarizeGraphQuery,
  tryParseGraphQuery,
  validateGraphQuery,
  type GraphQuery,
  type GraphQueryClause,
} from './graph-query-builder'

const makeEntity = (id: string, overrides: Partial<Entity> = {}): Entity => ({
  id,
  name: id.toUpperCase(),
  type: 'note',
  description: `desc ${id}`,
  content: `content ${id}`,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

const makeClaim = (id: string, entityId: string, overrides: Partial<Claim> = {}): Claim => ({
  id,
  entityId,
  statement: `claim ${id}`,
  confidence: 0.5,
  verification: 'unverified',
  ...overrides,
})

/** Deterministic corpus with a mix of types, tags, claims, and links. */
const corpus: { entities: Entity[]; claims: Claim[] } = {
  entities: [
    makeEntity('e1', {
      type: 'person',
      tags: ['triz'],
      links: [{ targetId: 'e2', relation: 'knows' }],
    }),
    makeEntity('e2', { type: 'concept', links: [{ targetId: 'e1', relation: 'knows' }] }),
    makeEntity('e3', { type: 'note', tags: ['triz', 'pkm'] }),
    makeEntity('e4', { type: 'concept', tags: ['method'] }),
    makeEntity('e5', { type: 'person', tags: ['method'] }),
  ],
  claims: [
    makeClaim('c1', 'e1', { verification: 'verified', confidence: 0.9 }),
    makeClaim('c2', 'e2', { confidence: 0.3 }),
    makeClaim('c3', 'e3', { verification: 'verified', confidence: 0.6 }),
    makeClaim('c4', 'e4', { verification: 'disputed', confidence: 0.55 }),
    makeClaim('c5', 'e5', { verification: 'verified', confidence: 0.95 }),
  ],
}

const entityIds = (result: FilteredGraph): string[] =>
  result.entities.map((entity) => entity.id)

const edgeKeys = (result: FilteredGraph): string[] =>
  result.edges.map((edge) => undirectedEdgeKey(edge.source, edge.target))

describe('query model primitives', () => {
  it('starts empty and matches the whole corpus', () => {
    expect(isGraphQueryEmpty(EMPTY_GRAPH_QUERY)).toBe(true)
    expect(validateGraphQuery(EMPTY_GRAPH_QUERY)).toEqual([])
    const result = evaluateGraphQuery(corpus.entities, corpus.claims, EMPTY_GRAPH_QUERY)
    expect(entityIds(result)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5'])
  })

  it('adds conditions and groups immutably', () => {
    const base = addQueryCondition(EMPTY_GRAPH_QUERY, [], 'entityType')
    expect(base.children).toHaveLength(1)
    expect(base.children[0]).toMatchObject({ kind: 'entityType', value: '', exclude: false })

    const grouped = addQueryGroup(EMPTY_GRAPH_QUERY, [], 'or')
    expect(grouped.children[0]).toMatchObject({ op: 'or', exclude: false, children: [] })
    const first = addQueryCondition(grouped, [0], 'tag')
    const firstChild = first.children[0]
    if (!firstChild || !('children' in firstChild)) throw new Error('expected a group')
    expect(firstChild.children).toHaveLength(1)
    expect(isGraphQueryEmpty(EMPTY_GRAPH_QUERY)).toBe(true)
  })

  it('ignores paths that descend through a condition', () => {
    const withCondition = addQueryCondition(EMPTY_GRAPH_QUERY, [], 'tag')
    expect(addQueryCondition(withCondition, [0, 0], 'tag')).toEqual(withCondition)
    expect(addQueryGroup(withCondition, [0], 'or')).toEqual(withCondition)
  })

  it('removes clauses and keeps siblings', () => {
    const withTwo = addQueryCondition(addQueryCondition(EMPTY_GRAPH_QUERY, [], 'tag'), [], 'tag')
    const one = removeQueryClause(withTwo, [0])
    expect(one.children).toHaveLength(1)
    expect(removeQueryClause(one, [0])).toEqual(EMPTY_GRAPH_QUERY)
  })

  it('updates group operator, exclude, and condition values', () => {
    const q = addQueryCondition(addQueryGroup(EMPTY_GRAPH_QUERY, [], 'and'), [0], 'text')
    expect(setQueryGroupOperator(q, [0], 'or').children[0]).toMatchObject({ op: 'or' })
    expect(setQueryClauseExclude(q, [0], true).children[0]).toMatchObject({ exclude: true })
    expect(setQueryClauseExclude(q, [], true)).toEqual(q)
    const updated = setQueryConditionValue(q, [0, 0], 'needle')
    const updatedChild = updated.children[0]
    if (!updatedChild || !('children' in updatedChild)) throw new Error('expected a group')
    expect(updatedChild.children[0]).toMatchObject({
      kind: 'text',
      value: 'needle',
      exclude: false,
    })
    expect(setQueryConditionValue(q, [0], 'nope')).toEqual(q)
  })
})

describe('validation', () => {
  it('rejects a blank condition value without silently broadening', () => {
    const q = addQueryCondition(EMPTY_GRAPH_QUERY, [], 'text')
    const issues = validateGraphQuery(q)
    expect(issues.some((issue) => issue.message === 'blank-value')).toBe(true)
  })

  it('rejects an empty nested group (fail-closed semantics)', () => {
    const q = addQueryGroup(EMPTY_GRAPH_QUERY, [], 'and')
    expect(validateGraphQuery(q).some((issue) => issue.message === 'empty-group')).toBe(true)
    // The nested empty group matches nothing, so the query matches nothing.
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, q))).toEqual([])
  })

  it('rejects over-length values', () => {
    const q = setQueryConditionValue(
      addQueryCondition(EMPTY_GRAPH_QUERY, [], 'text'),
      [0],
      'x'.repeat(MAX_QUERY_VALUE_LENGTH + 1),
    )
    expect(validateGraphQuery(q).some((issue) => issue.message === 'too-long')).toBe(true)
  })

  it('rejects root exclusion and out-of-range confidence', () => {
    expect(validateGraphQuery({ ...EMPTY_GRAPH_QUERY, exclude: true }).some(
      (issue) => issue.message === 'root-exclude',
    )).toBe(true)
    const q = setQueryConditionValue(
      addQueryCondition(EMPTY_GRAPH_QUERY, [], 'minConfidence'),
      [0],
      1.5,
    )
    expect(validateGraphQuery(q).some((issue) => issue.message === 'confidence-range')).toBe(true)
  })

  it('rejects excessive nesting depth', () => {
    let q = EMPTY_GRAPH_QUERY
    let path: number[] = []
    for (let level = 0; level < MAX_QUERY_DEPTH; level += 1) {
      const parent = path.reduce((group, index) => {
        const child = group.children[index]
        if (!child || !('children' in child)) throw new Error('expected a group')
        return child
      }, q)
      const nestedGroupIndex = parent.children.length
      q = addQueryGroup(q, path, 'and')
      const nestedPath = [...path, nestedGroupIndex]
      q = addQueryCondition(q, nestedPath, 'tag')
      q = setQueryConditionValue(q, [...nestedPath, 0], 'value')
      path = nestedPath
    }
    expect(validateGraphQuery(q).some((issue) => issue.message === 'depth')).toBe(true)
  })

  it('rejects excessive clause counts', () => {
    let q = EMPTY_GRAPH_QUERY
    for (let index = 0; index < MAX_QUERY_CLAUSES + 1; index += 1) {
      q = addQueryCondition(q, [], 'tag')
      q = setQueryConditionValue(q, [index], 'value')
    }
    expect(validateGraphQuery(q).some((issue) => issue.message === 'clause-count')).toBe(true)
  })
})

describe('serialization', () => {
  it('round-trips a nested query deterministically', () => {
    let q = addQueryCondition(EMPTY_GRAPH_QUERY, [], 'entityType')
    q = setQueryConditionValue(q, [0], 'person')
    q = addQueryGroup(q, [], 'or')
    q = setQueryClauseExclude(q, [1], true)
    q = addQueryCondition(q, [1], 'claimStatus')
    q = setQueryConditionValue(q, [1, 0], 'verified')

    const first = serializeGraphQuery(q)
    expect(serializeGraphQuery(q)).toBe(first)
    const parsed = tryParseGraphQuery(first)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.query).toEqual(q)
  })

  it('rejects malformed and invalid serialized queries', () => {
    expect(tryParseGraphQuery('{').ok).toBe(false)
    const invalid = tryParseGraphQuery(JSON.stringify({ op: 'and', exclude: true, children: [] }))
    expect(invalid.ok).toBe(false)
    expect(GraphQuerySchema.safeParse({ op: 'and', exclude: true, children: [] }).success).toBe(false)
  })
})

describe('evaluation semantics', () => {
  it('AND requires every condition', () => {
    let q = addQueryCondition(EMPTY_GRAPH_QUERY, [], 'entityType')
    q = setQueryConditionValue(q, [0], 'person')
    q = addQueryCondition(q, [], 'tag')
    q = setQueryConditionValue(q, [1], 'triz')
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, q))).toEqual(['e1'])
  })

  it('OR matches any condition', () => {
    const q = { op: 'or', exclude: false, children: [
      { kind: 'entityType', value: 'person', exclude: false },
      { kind: 'tag', value: 'triz', exclude: false },
    ] } satisfies GraphQuery
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, q))).toEqual([
      'e1', 'e3', 'e5',
    ])
  })

  it('exclude negates a clause inside its group', () => {
    const q = { op: 'and', exclude: false, children: [
      { kind: 'entityType', value: 'person', exclude: false },
      { kind: 'tag', value: 'triz', exclude: false },
    ] } satisfies GraphQuery
    // As-is: person AND triz → e1 only.
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, q))).toEqual(['e1'])

    const excluded = { ...q, children: [{ ...q.children[0] }, { ...q.children[1], exclude: true }] }
    // person AND NOT triz → e5 only.
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, excluded))).toEqual(['e5'])
  })

  it('text matches name/description/content case-insensitively', () => {
    const q = { op: 'and', exclude: false, children: [{ kind: 'text', value: 'DESC E3', exclude: false }] } satisfies GraphQuery
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, q))).toEqual(['e3'])
  })

  it('claim status and confidence conditions use the entity claims', () => {
    const verified = { op: 'and', exclude: false, children: [{ kind: 'claimStatus', value: 'verified', exclude: false }] } satisfies GraphQuery
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, verified))).toEqual([
      'e1', 'e3', 'e5',
    ])

    const confident = { op: 'and', exclude: false, children: [{ kind: 'minConfidence', value: 0.9, exclude: false }] } satisfies GraphQuery
    expect(entityIds(evaluateGraphQuery(corpus.entities, corpus.claims, confident))).toEqual([
      'e1', 'e5',
    ])
  })

  it('edges connect matched entities only', () => {
    const q = { op: 'and', exclude: false, children: [{ kind: 'entityType', value: 'person', exclude: false }] } satisfies GraphQuery
    const result = evaluateGraphQuery(corpus.entities, corpus.claims, q)
    expect(entityIds(result)).toEqual(['e1', 'e5'])
    expect(edgeKeys(result)).toEqual([])
  })

  it('produces a readable summary', () => {
    let q = addQueryCondition(EMPTY_GRAPH_QUERY, [], 'entityType')
    q = setQueryConditionValue(q, [0], 'person')
    q = addQueryCondition(q, [], 'tag')
    q = setQueryConditionValue(q, [1], 'triz')
    expect(summarizeGraphQuery(q)).toBe('type:person AND tag:triz')
    expect(summarizeGraphQuery(EMPTY_GRAPH_QUERY)).toBe('no conditions')
  })
})

describe('consistency with the renderer filter', () => {
  it('matches filterGraph for the conjunctive subset of facets', () => {
    const filter = {
      ...EMPTY_GRAPH_FILTER,
      types: ['person'],
      tags: ['method'],
      verifiedOnly: true,
      minConfidence: 0.9,
    }
    const query: GraphQuery = {
      op: 'and',
      exclude: false,
      children: [
        { kind: 'entityType', value: 'person', exclude: false },
        { kind: 'tag', value: 'method', exclude: false },
        { kind: 'claimStatus', value: 'verified', exclude: false },
        { kind: 'minConfidence', value: 0.9, exclude: false },
      ],
    }
    const rendered = filterGraph(corpus.entities, corpus.claims, filter)
    const preview = evaluateGraphQuery(corpus.entities, corpus.claims, query)
    expect(entityIds(preview)).toEqual(entityIds(rendered))
    expect(edgeKeys(preview)).toEqual(edgeKeys(rendered))
  })
})

const facetClauses = (kind: 'entityType' | 'tag', values: string[]): GraphQueryClause[] => {
  const conditions: GraphQueryClause[] = values.map((value) =>
    kind === 'entityType'
      ? { kind: 'entityType', value, exclude: false }
      : { kind: 'tag', value, exclude: false },
  )
  return conditions.length < 2 ? conditions : [{ op: 'or', exclude: false, children: conditions }]
}

const conditionArb = fc.oneof(
  fc.record({ kind: fc.constant('entityType'), value: fc.stringMatching(/^[a-z0-9-]{1,20}$/), exclude: fc.boolean() }),
  fc.record({ kind: fc.constant('tag'), value: fc.stringMatching(/^[a-z0-9-]{1,20}$/), exclude: fc.boolean() }),
  fc.record({ kind: fc.constant('text'), value: fc.stringMatching(/^[a-z0-9-]{1,20}$/), exclude: fc.boolean() }),
  fc.record({ kind: fc.constant('claimStatus'), value: fc.constantFrom('unverified', 'verified', 'disputed'), exclude: fc.boolean() }),
  fc.record({ kind: fc.constant('minConfidence'), value: fc.float({ min: 0, max: 1, noNaN: true }), exclude: fc.boolean() }),
)

const clauseArb = (depth: number): fc.Arbitrary<GraphQueryClause> =>
  depth <= 0
    ? conditionArb
    : fc.oneof(
        conditionArb,
        fc.record({
          op: fc.constantFrom('and', 'or'),
          exclude: fc.boolean(),
          children: fc.array(clauseArb(depth - 1), { minLength: 1, maxLength: 4 }),
        }),
      )

/** Counts every clause (conditions and groups, root included), as the validator does. */
const countQueryClauses = (clause: GraphQueryClause): number =>
  'children' in clause ? 1 + clause.children.reduce((sum, child) => sum + countQueryClauses(child), 0) : 1

const queryArb: fc.Arbitrary<GraphQuery> = fc
  .record({
    op: fc.constantFrom('and', 'or'),
    exclude: fc.constant(false),
    children: fc.array(clauseArb(3), { maxLength: 4 }),
  })
  // The nesting grammar can exceed MAX_QUERY_CLAUSES; such inputs are out of
  // the model's domain (validateGraphQuery rightly reports them), so they are
  // excluded rather than asserted valid.
  .filter((query) => countQueryClauses(query) <= MAX_QUERY_CLAUSES)

describe('property tests', () => {
  test.prop([queryArb], getPropertyTestParameters())(
    'every generated query is valid and round-trips through serialization',
    (query) => {
      expect(validateGraphQuery(query)).toEqual([])
      expect(GraphQuerySchema.safeParse(query).success).toBe(true)
      const parsed = tryParseGraphQuery(serializeGraphQuery(query))
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(parsed.query).toEqual(query)
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([queryArb], getPropertyTestParameters())(
    'evaluation stays within the corpus bounds and never invents edges',
    (query) => {
      const result = evaluateGraphQuery(corpus.entities, corpus.claims, query)
      expect(result.entities.length).toBeLessThanOrEqual(corpus.entities.length)
      const ids = new Set(result.entities.map((entity) => entity.id))
      for (const edge of result.edges) {
        expect(ids.has(edge.source)).toBe(true)
        expect(ids.has(edge.target)).toBe(true)
      }
      for (const claim of result.claims) {
        expect(ids.has(claim.entityId)).toBe(true)
      }
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop(
    [
      fc.array(fc.constantFrom('person', 'concept', 'note'), { maxLength: 3 }),
      fc.array(fc.constantFrom('triz', 'method', 'pkm'), { maxLength: 3 }),
      fc.boolean(),
      fc.float({ min: 0, max: 1, noNaN: true }),
    ],
    getPropertyTestParameters(),
  )(
    'the flat conjunctive query equals filterGraph on the same facets',
    (types, tags, verifiedOnly, minConfidence) => {
      const filter = {
        ...EMPTY_GRAPH_FILTER,
        types,
        tags,
        verifiedOnly,
        minConfidence,
      }
      const query: GraphQuery = {
        op: 'and',
        exclude: false,
        children: [
          ...facetClauses('entityType', types),
          ...facetClauses('tag', tags),
          ...(verifiedOnly
            ? [{ kind: 'claimStatus' as const, value: 'verified' as const, exclude: false }]
            : []),
          ...(minConfidence > 0
            ? [{ kind: 'minConfidence' as const, value: minConfidence, exclude: false }]
            : []),
        ],
      }
      const rendered = filterGraph(corpus.entities, corpus.claims, filter)
      const preview = evaluateGraphQuery(corpus.entities, corpus.claims, query)
      expect(new Set(entityIds(preview))).toEqual(new Set(entityIds(rendered)))
      expect(new Set(edgeKeys(preview))).toEqual(new Set(edgeKeys(rendered)))
    },
    getPropertyTestTimeoutMs(),
  )
})
