/**
 * Visual nested AND/OR query composition for the graph canvas (#1164).
 *
 * A `GraphQuery` is a tree of clauses: leaf conditions over entity/claim
 * fields, and AND/OR groups that combine them. It is a pure data model —
 * evaluation lives in `graph-query.ts` (`evaluateGraphQuery`), which reuses
 * the same claim/edge semantics as `filterGraph`, so the builder's preview
 * always matches what the canvas draws. Stored queries are validated by the
 * Zod schema (bounded depth, clause count, and string lengths) and serialize
 * deterministically into saved views.
 *
 * Semantics:
 * - The root is a group. An empty root means "no conditions" and matches every
 *   entity (the natural start state).
 * - A group matches when its operator combines its children: AND requires all
 *   children to match, OR requires at least one. An empty non-root group
 *   matches **nothing** — it never silently broadens a query.
 * - Every clause carries an `exclude` flag that negates that clause's result
 *   within its group, conditions included. The root itself cannot be excluded
 *   (it defines membership).
 * - A condition matches an entity based on the entity's own fields and claims:
 *   type, tag, text (name/description/content substring), claim status, or
 *   minimum claim confidence.
 */
import { z } from 'zod'
import type { VerificationStatus } from './types'

/** Longest chain of nested groups, root counted (nesting up to 3 levels). */
export const MAX_QUERY_DEPTH = 4

/** Total non-root clauses (conditions + groups) allowed in one query. */
export const MAX_QUERY_CLAUSES = 64

/** Longest accepted tag/text condition value. */
export const MAX_QUERY_VALUE_LENGTH = 120

/** Condition kinds the builder can create, in UI order. */
export const QUERY_CONDITION_KINDS = [
  'entityType',
  'tag',
  'text',
  'claimStatus',
  'minConfidence',
] as const

export type GraphQueryConditionKind = (typeof QUERY_CONDITION_KINDS)[number]

/** A leaf predicate over one entity and its claims; `exclude` negates it. */
export type GraphQueryCondition =
  | { kind: 'entityType'; value: string; exclude: boolean }
  | { kind: 'tag'; value: string; exclude: boolean }
  | { kind: 'text'; value: string; exclude: boolean }
  | { kind: 'claimStatus'; value: VerificationStatus; exclude: boolean }
  | { kind: 'minConfidence'; value: number; exclude: boolean }

/** A group of clauses combined by an operator; `exclude` negates the group. */
export interface GraphQueryGroup {
  op: 'and' | 'or'
  exclude: boolean
  children: GraphQueryClause[]
}

/** A clause is either a leaf condition or a nested group. */
export type GraphQueryClause = GraphQueryCondition | GraphQueryGroup

/** The root query: a group. Its `exclude` is always false. */
export type GraphQuery = GraphQueryGroup

/** A query with no conditions: matches the whole corpus. */
export const EMPTY_GRAPH_QUERY: GraphQuery = { op: 'and', exclude: false, children: [] }

/** One validation problem with a query, with the clause path it concerns. */
export interface GraphQueryIssue {
  /** Child indices from the root to the offending clause; [] is the root. */
  path: number[]
  /** Machine-readable issue id; callers map it to localized copy. */
  message: string
}

const stringValueSchema = (kind: 'entityType' | 'tag' | 'text') =>
  z.object({
    kind: z.literal(kind),
    value: z
      .string()
      .min(1)
      .max(MAX_QUERY_VALUE_LENGTH)
      .refine((value) => value.trim().length > 0, 'blank value'),
    exclude: z.boolean(),
  })

const GraphQueryConditionSchema = z.discriminatedUnion('kind', [
  stringValueSchema('entityType'),
  stringValueSchema('tag'),
  stringValueSchema('text'),
  z.object({
    kind: z.literal('claimStatus'),
    value: z.enum(['unverified', 'verified', 'disputed']),
    exclude: z.boolean(),
  }),
  z.object({
    kind: z.literal('minConfidence'),
    value: z.number().min(0).max(1),
    exclude: z.boolean(),
  }),
])

const GraphQueryGroupSchema: z.ZodType<GraphQueryGroup> = z.lazy(() =>
  z.object({
    op: z.enum(['and', 'or']),
    exclude: z.boolean(),
    children: z.array(GraphQueryClauseSchema).max(MAX_QUERY_CLAUSES),
  }),
)

const GraphQueryClauseSchema: z.ZodType<GraphQueryClause> = z.union([
  GraphQueryConditionSchema,
  GraphQueryGroupSchema,
])

/**
 * Zod schema for a stored query. Parsing validates structure AND semantics:
 * root exclusion, depth, clause count, blank values, and empty non-root
 * groups are rejected so an invalid query can never be persisted.
 */
export const GraphQuerySchema: z.ZodType<GraphQuery> = GraphQueryGroupSchema.superRefine(
  (query, ctx) => {
    for (const issue of validateGraphQuery(query)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
  },
)

/** True when the query has no conditions at all (matches everything). */
export const isGraphQueryEmpty = (query: GraphQuery): boolean => query.children.length === 0

/**
 * Validates a query. Returns a list of issues; an empty list means the query
 * is safe to apply and save. An invalid query must never be applied silently —
 * callers surface these issues instead of broadening the query.
 */
export const validateGraphQuery = (query: GraphQuery): GraphQueryIssue[] => {
  const issues: GraphQueryIssue[] = []
  let clauseCount = 0

  const walk = (clause: GraphQueryClause, path: number[], groupDepth: number): void => {
    if ('children' in clause) {
      clauseCount += 1
      if (clauseCount > MAX_QUERY_CLAUSES) {
        issues.push({ path, message: 'clause-count' })
        return
      }
      if (groupDepth > MAX_QUERY_DEPTH) {
        issues.push({ path, message: 'depth' })
        return
      }
      if (clause.children.length === 0 && path.length > 0) {
        issues.push({ path, message: 'empty-group' })
      }
      for (let index = 0; index < clause.children.length; index += 1) {
        walk(clause.children[index]!, [...path, index], groupDepth + 1)
      }
      return
    }

    clauseCount += 1
    if (clauseCount > MAX_QUERY_CLAUSES) {
      issues.push({ path, message: 'clause-count' })
      return
    }
    if (typeof clause.value === 'string') {
      if (clause.value.trim().length === 0) {
        issues.push({ path, message: 'blank-value' })
      } else if (clause.value.length > MAX_QUERY_VALUE_LENGTH) {
        issues.push({ path, message: 'too-long' })
      }
    } else if (clause.value < 0 || clause.value > 1) {
      issues.push({ path, message: 'confidence-range' })
    }
  }

  if (query.exclude) {
    issues.push({ path: [], message: 'root-exclude' })
  }
  for (let index = 0; index < query.children.length; index += 1) {
    walk(query.children[index]!, [index], 2)
  }
  return issues
}

/** True when the query is non-empty and passes validation. */
export const isGraphQueryActive = (query: GraphQuery): boolean =>
  !isGraphQueryEmpty(query) && validateGraphQuery(query).length === 0

/** Immutably replaces the clause at `path` inside a copy of the tree. */
const replaceAt = (root: GraphQuery, path: number[], replace: (clause: GraphQueryClause) => GraphQueryClause): GraphQuery => {
  if (path.length === 0) {
    const replacement = replace(root)
    return 'children' in replacement ? replacement : root
  }

  const [head, ...rest] = path
  if (head === undefined) return root
  const child = root.children[head]
  if (!child) return root

  let replacement: GraphQueryClause
  if (rest.length === 0) {
    replacement = replace(child)
  } else {
    if (!('children' in child)) return root
    replacement = replaceAt(child, rest, replace)
  }
  if (replacement === child) return root
  const children = [...root.children]
  children[head] = replacement
  return { ...root, children }
}

/** Default value for a newly added condition of a kind. */
export const defaultConditionValue = (kind: GraphQueryConditionKind): string | number => {
  if (kind === 'claimStatus') return 'unverified'
  if (kind === 'minConfidence') return 0.5
  return ''
}

/** Creates a fresh condition of a kind with its default value. */
export const makeQueryCondition = (kind: GraphQueryConditionKind): GraphQueryCondition => {
  const value = defaultConditionValue(kind)
  if (kind === 'claimStatus') return { kind, value: value as VerificationStatus, exclude: false }
  if (kind === 'minConfidence') return { kind, value: value as number, exclude: false }
  return { kind, value: value as string, exclude: false }
}

/** Creates a fresh, empty group. */
export const makeQueryGroup = (op: 'and' | 'or' = 'and'): GraphQueryGroup => ({
  op,
  exclude: false,
  children: [],
})

/** Appends a condition of `kind` to the group at `path` (root when empty). */
export const addQueryCondition = (
  query: GraphQuery,
  path: number[],
  kind: GraphQueryConditionKind,
): GraphQuery => {
  const addition = makeQueryCondition(kind)
  if (path.length === 0) return { ...query, children: [...query.children, addition] }
  return replaceAt(query, path, (clause) =>
    'children' in clause ? { ...clause, children: [...clause.children, addition] } : clause,
  )
}

/** Appends an empty AND/OR group to the group at `path`. */
export const addQueryGroup = (query: GraphQuery, path: number[], op: 'and' | 'or'): GraphQuery => {
  const addition = makeQueryGroup(op)
  if (path.length === 0) return { ...query, children: [...query.children, addition] }
  return replaceAt(query, path, (clause) =>
    'children' in clause ? { ...clause, children: [...clause.children, addition] } : clause,
  )
}

/** Removes the clause at `path`. */
export const removeQueryClause = (query: GraphQuery, path: number[]): GraphQuery => {
  if (path.length === 0) return query
  const [head, ...rest] = path
  if (rest.length === 0) {
    return { ...query, children: query.children.filter((_, index) => index !== head) }
  }
  return replaceAt(query, [head], (clause) =>
    'children' in clause ? { ...clause, children: clause.children.filter((_, index) => index !== rest[0]) } : clause,
  )
}

/** Replaces the clause at `path` with a new clause (no-op at the root). */
export const replaceQueryClause = (
  query: GraphQuery,
  path: number[],
  clause: GraphQueryClause,
): GraphQuery => {
  if (path.length === 0) return query
  return replaceAt(query, path, () => clause)
}

/** Sets the operator of the group at `path` (no-op for conditions/root). */
export const setQueryGroupOperator = (
  query: GraphQuery,
  path: number[],
  op: 'and' | 'or',
): GraphQuery => {
  if (path.length === 0) return { ...query, op }
  return replaceAt(query, path, (clause) =>
    'children' in clause ? { ...clause, op } : clause,
  )
}

/** Sets the exclude flag of the clause at `path` (never on the root). */
export const setQueryClauseExclude = (
  query: GraphQuery,
  path: number[],
  exclude: boolean,
): GraphQuery => {
  if (path.length === 0) return query
  return replaceAt(query, path, (clause) => ({ ...clause, exclude }))
}

/** Sets the value of the condition at `path` (no-op for groups). */
export const setQueryConditionValue = (
  query: GraphQuery,
  path: number[],
  value: string | number,
): GraphQuery => {
  if (path.length === 0) return query
  return replaceAt(query, path, (clause) => {
    if ('children' in clause) return clause
    if (clause.kind === 'minConfidence') {
      return { ...clause, value: typeof value === 'number' ? value : Number(value) }
    }
    if (clause.kind === 'claimStatus') {
      const status: VerificationStatus =
        value === 'unverified' || value === 'verified' || value === 'disputed'
          ? value
          : 'unverified'
      return { ...clause, value: status }
    }
    return { ...clause, value: typeof value === 'string' ? value : String(value) }
  })
}

const serializeClause = (clause: GraphQueryClause): unknown =>
  'children' in clause
    ? { op: clause.op, exclude: clause.exclude, children: clause.children.map(serializeClause) }
    : { kind: clause.kind, value: clause.value, exclude: clause.exclude }

/**
 * Serializes a query deterministically: the same query always yields the same
 * string because it is rebuilt in a fixed key order before stringification.
 */
export const serializeGraphQuery = (query: GraphQuery): string =>
  JSON.stringify({
    op: query.op,
    exclude: false,
    children: query.children.map(serializeClause),
  })

/** Parses a serialized query; returns an error string when it is not valid. */
export const tryParseGraphQuery = (json: string): { ok: true; query: GraphQuery } | { ok: false; error: string } => {
  try {
    const parsed = JSON.parse(json) as unknown
    const result = GraphQuerySchema.safeParse(parsed)
    if (!result.success) return { ok: false, error: result.error.message }
    return { ok: true, query: result.data }
  } catch {
    return { ok: false, error: 'invalid JSON' }
  }
}

const conditionLabel = (condition: GraphQueryCondition): string => {
  switch (condition.kind) {
    case 'entityType':
      return `type:${condition.value}`
    case 'tag':
      return `tag:${condition.value}`
    case 'text':
      return `text:"${condition.value}"`
    case 'claimStatus':
      return `claim:${condition.value}`
    case 'minConfidence':
      return `confidence ≥ ${condition.value}`
  }
}

const groupLabel = (group: GraphQueryGroup): string => {
  const inner =
    group.children.length === 0
      ? '∅'
      : group.children.map(clauseLabel).join(group.op === 'and' ? ' AND ' : ' OR ')
  return group.children.length > 1 ? `(${inner})` : inner
}

const clauseLabel = (clause: GraphQueryClause): string => {
  const label = 'children' in clause ? groupLabel(clause) : conditionLabel(clause)
  return clause.exclude ? `NOT ${label}` : label
}

/**
 * A readable, deterministic summary of the active query, e.g.
 * `(type:person AND claim:verified) OR tag:triz`. Empty queries read
 * `no conditions`.
 */
export const summarizeGraphQuery = (query: GraphQuery): string => {
  if (query.children.length === 0) return 'no conditions'
  return query.children.map(clauseLabel).join(query.op === 'and' ? ' AND ' : ' OR ')
}
