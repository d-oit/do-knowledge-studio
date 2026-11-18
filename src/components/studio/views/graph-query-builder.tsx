'use client'

import { useMemo } from 'react'
import type { Claim, Entity } from '@/lib/studio/types'
import { evaluateGraphQuery } from '@/lib/studio/graph-query'
import {
  MAX_QUERY_CLAUSES,
  MAX_QUERY_DEPTH,
  MAX_QUERY_VALUE_LENGTH,
  QUERY_CONDITION_KINDS,
  addQueryCondition,
  addQueryGroup,
  isGraphQueryEmpty,
  makeQueryCondition,
  removeQueryClause,
  replaceQueryClause,
  setQueryClauseExclude,
  setQueryConditionValue,
  setQueryGroupOperator,
  summarizeGraphQuery,
  validateGraphQuery,
  type GraphQuery,
  type GraphQueryClause,
  type GraphQueryCondition,
  type GraphQueryConditionKind,
  type GraphQueryIssue,
} from '@/lib/studio/graph-query-builder'
import { getEntityTypeDefs } from '@/lib/studio/entity-types'
import { translate } from '@/lib/i18n/messages/graph'
import { cn } from '@/lib/utils'

const FIELD_CLASS =
  'min-h-touch rounded-md border border-border bg-background px-2 py-1 text-label text-ink focus-ring'

/** Counts every non-root clause (conditions + groups) in the query. */
const countClauses = (query: GraphQuery): number =>
  query.children.reduce((total, clause) => {
    if ('children' in clause) return total + 1 + countClauses(clause)
    return total + 1
  }, 0)

const kindLabel = (kind: GraphQueryConditionKind): string => {
  switch (kind) {
    case 'entityType':
      return translate('graph.builder.kind.entityType')
    case 'tag':
      return translate('graph.builder.kind.tag')
    case 'text':
      return translate('graph.builder.kind.text')
    case 'claimStatus':
      return translate('graph.builder.kind.claimStatus')
    case 'minConfidence':
      return translate('graph.builder.kind.minConfidence')
  }
}

const issueMessage = (issue: GraphQueryIssue): string => {
  switch (issue.message) {
    case 'blank-value':
      return translate('graph.builder.error.blankValue')
    case 'too-long':
      return translate('graph.builder.error.tooLong', String(MAX_QUERY_VALUE_LENGTH))
    case 'empty-group':
      return translate('graph.builder.error.emptyGroup')
    case 'depth':
      return translate('graph.builder.error.depth', String(MAX_QUERY_DEPTH))
    case 'clause-count':
      return translate('graph.builder.error.clauseCount', String(MAX_QUERY_CLAUSES))
    case 'root-exclude':
      return translate('graph.builder.error.rootExclude')
    case 'confidence-range':
      return translate('graph.builder.error.confidenceRange')
    default:
      return issue.message
  }
}

/** The value control for one leaf condition, keyed by its kind. */
const ConditionControl = ({
  condition,
  onValue,
}: {
  condition: GraphQueryCondition
  onValue: (value: string | number) => void
}) => {
  const typeDefs = getEntityTypeDefs()
  switch (condition.kind) {
    case 'entityType': {
      const known = typeDefs.some((def) => def.id === condition.value)
      return (
        <select
          aria-label={kindLabel(condition.kind)}
          value={condition.value}
          onChange={(e) => {
            onValue(e.target.value)
          }}
          className={cn(FIELD_CLASS, 'max-w-64 flex-1')}
        >
          {!known && <option value={condition.value}>{condition.value}</option>}
          {typeDefs.map((def) => (
            <option key={def.id} value={def.id}>
              {def.label}
            </option>
          ))}
        </select>
      )
    }
    case 'tag':
    case 'text':
      return (
        <input
          type="text"
          aria-label={kindLabel(condition.kind)}
          value={condition.value}
          maxLength={MAX_QUERY_VALUE_LENGTH}
          onChange={(e) => {
            onValue(e.target.value)
          }}
          className={cn(FIELD_CLASS, 'min-w-40 flex-1')}
        />
      )
    case 'claimStatus':
      return (
        <select
          aria-label={kindLabel(condition.kind)}
          value={condition.value}
          onChange={(e) => {
            onValue(e.target.value)
          }}
          className={cn(FIELD_CLASS, 'max-w-44 flex-1')}
        >
          <option value="unverified">unverified</option>
          <option value="verified">verified</option>
          <option value="disputed">disputed</option>
        </select>
      )
    case 'minConfidence':
      return (
        <label className="flex flex-1 items-center gap-2 text-label text-ink-soft">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={condition.value}
            onChange={(e) => {
              onValue(Number(e.target.value))
            }}
            className="w-32 accent-saffron"
            aria-label={translate(
              'graph.builder.kind.minConfidence',
              String(Math.round(condition.value * 100)),
            )}
          />
          <span>{String(Math.round(condition.value * 100))}%</span>
        </label>
      )
  }
}

/**
 * One row of the tree. Groups render as nested fieldsets that own their
 * children; conditions render as a single row with kind, value, exclude, and
 * remove controls. Everything is native form controls, so the whole tree is
 * keyboard-operable and announced by screen readers without custom focus
 * management.
 */
const ClauseList = ({
  clauses,
  path,
  depth,
  query,
  onQueryChange,
}: {
  clauses: GraphQueryClause[]
  path: number[]
  depth: number
  query: GraphQuery
  onQueryChange: (next: GraphQuery) => void
}) => {
  const atClauseCap = countClauses(query) >= MAX_QUERY_CLAUSES
  const atDepthCap = depth >= MAX_QUERY_DEPTH

  // Screen readers announce each list by name, distinguishing a group's list
  // from the validation list that may share the panel.
  const listLabel = translate('graph.builder.list.conditions')

  return (
    <ul className="space-y-1" role="list" aria-label={listLabel}>
      {clauses.map((clause, index) => {
        const clausePath = [...path, index]
        const removeLabel = 'children' in clause
          ? translate('graph.builder.group')
          : clause.value === ''
            ? kindLabel(clause.kind)
            : `${kindLabel(clause.kind)} ${clause.value}`
        if ('children' in clause) {
          return (
            <li key={clausePath.join('.')} role="listitem">
              <fieldset className="rounded-md border border-border bg-card/40 p-2">
                <legend className="sr-only">{translate('graph.builder.group')}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={translate('graph.builder.group')}
                    value={clause.op}
                    onChange={(e) => {
                      const op = e.target.value === 'or' ? 'or' : 'and'
                      onQueryChange(setQueryGroupOperator(query, clausePath, op))
                    }}
                    className={cn(FIELD_CLASS, 'max-w-28')}
                  >
                    <option value="and">{translate('graph.builder.and')}</option>
                    <option value="or">{translate('graph.builder.or')}</option>
                  </select>
                  <label className="flex min-h-touch cursor-pointer items-center gap-1.5 text-label text-ink-soft">
                    <input
                      type="checkbox"
                      checked={clause.exclude}
                      onChange={(e) => {
                        onQueryChange(setQueryClauseExclude(query, clausePath, e.target.checked))
                      }}
                      className="h-4 w-4 accent-saffron focus-ring"
                    />
                    {translate('graph.builder.exclude')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      onQueryChange(removeQueryClause(query, clausePath))
                    }}
                    aria-label={translate('graph.builder.removeAria', removeLabel)}
                    className="min-h-touch rounded px-2 text-label font-medium text-ink-mute transition-colors hover:text-ink focus-ring"
                  >
                    ×
                  </button>
                </div>

                {clause.children.length > 0 && (
                  <ClauseList
                    clauses={clause.children}
                    path={clausePath}
                    depth={depth + 1}
                    query={query}
                    onQueryChange={onQueryChange}
                  />
                )}

                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={atClauseCap}
                    onClick={() => {
                      onQueryChange(addQueryCondition(query, clausePath, 'entityType'))
                    }}
                    className="min-h-touch rounded px-2 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring disabled:opacity-50"
                  >
                    + {translate('graph.builder.addCondition')}
                  </button>
                  <button
                    type="button"
                    disabled={atClauseCap || atDepthCap}
                    onClick={() => {
                      onQueryChange(addQueryGroup(query, clausePath, 'and'))
                    }}
                    className="min-h-touch rounded px-2 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring disabled:opacity-50"
                  >
                    + {translate('graph.builder.addGroup')}
                  </button>
                </div>
              </fieldset>
            </li>
          )
        }
        return (
          <li key={clausePath.join('.')} role="listitem">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-1">
              <select
                aria-label={translate('graph.builder.condition')}
                value={clause.kind}
                onChange={(e) => {
                  const kind = e.target.value as GraphQueryConditionKind
                  onQueryChange(replaceQueryClause(query, clausePath, makeQueryCondition(kind)))
                }}
                className={cn(FIELD_CLASS, 'max-w-40')}
              >
                {QUERY_CONDITION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </select>
              <ConditionControl
                condition={clause}
                onValue={(value) => {
                  onQueryChange(setQueryConditionValue(query, clausePath, value))
                }}
              />
              <label className="flex min-h-touch cursor-pointer items-center gap-1.5 text-label text-ink-soft">
                <input
                  type="checkbox"
                  checked={clause.exclude}
                  onChange={(e) => {
                    onQueryChange(setQueryClauseExclude(query, clausePath, e.target.checked))
                  }}
                  className="h-4 w-4 accent-saffron focus-ring"
                />
                {translate('graph.builder.exclude')}
              </label>
              <button
                type="button"
                onClick={() => {
                  onQueryChange(removeQueryClause(query, clausePath))
                }}
                aria-label={translate('graph.builder.removeAria', removeLabel)}
                className="min-h-touch rounded px-2 text-label font-medium text-ink-mute transition-colors hover:text-ink focus-ring"
              >
                ×
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Compact visual builder for nested AND/OR queries over the graph corpus. */
export const GraphQueryBuilder = ({
  entities,
  claims,
  query,
  onQueryChange,
}: {
  entities: Entity[]
  claims: Claim[]
  query: GraphQuery
  onQueryChange: (next: GraphQuery) => void
}) => {
  // The preview and the canvas run the same evaluator, so the counts always
  // describe what the renderer will draw. Invalid queries show no counts and
  // are never applied.
  const issues = useMemo(() => validateGraphQuery(query), [query])
  const preview = useMemo(() => {
    if (issues.length > 0) return null
    return evaluateGraphQuery(entities, claims, query)
  }, [entities, claims, query, issues])

  const atClauseCap = countClauses(query) >= MAX_QUERY_CLAUSES

  return (
    <section
      aria-labelledby="graph-builder-heading"
      className="rounded-md border border-border p-3"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 id="graph-builder-heading" className="font-serif text-body font-semibold text-ink">
          {translate('graph.builder.heading')}
        </h3>
        <span aria-live="polite" className="text-label text-ink-faint">
          {isGraphQueryEmpty(query)
            ? translate('graph.builder.summary.empty')
            : translate('graph.builder.summary.query', summarizeGraphQuery(query))}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-label text-ink-soft">
          {translate('graph.builder.match')}
          <select
            value={query.op}
            onChange={(e) => {
              const op = e.target.value === 'or' ? 'or' : 'and'
              onQueryChange(setQueryGroupOperator(query, [], op))
            }}
            className={cn(FIELD_CLASS, 'max-w-24')}
          >
            <option value="and">{translate('graph.builder.and')}</option>
            <option value="or">{translate('graph.builder.or')}</option>
          </select>
        </label>
        <button
          type="button"
          disabled={atClauseCap}
          onClick={() => {
            onQueryChange(addQueryCondition(query, [], 'entityType'))
          }}
          className="min-h-touch rounded px-2 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring disabled:opacity-50"
        >
          + {translate('graph.builder.addCondition')}
        </button>
        <button
          type="button"
          disabled={atClauseCap}
          onClick={() => {
            onQueryChange(addQueryGroup(query, [], 'and'))
          }}
          className="min-h-touch rounded px-2 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring disabled:opacity-50"
        >
          + {translate('graph.builder.addGroup')}
        </button>
      </div>

      {issues.length > 0 && (
        <div role="alert" className="mb-2 rounded-md border border-border bg-card/40 p-2">
          <p className="text-label font-medium text-ink">
            {translate('graph.builder.errors.title', String(issues.length))}
          </p>
          <ul className="space-y-0.5 text-label text-ink-soft">
            {issues.map((issue, index) => (
              <li key={`${issue.path.join('.')}-${index}`}>{issueMessage(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {query.children.length > 0 && (
        <ClauseList
          clauses={query.children}
          path={[]}
          depth={1}
          query={query}
          onQueryChange={onQueryChange}
        />
      )}

      <p aria-live="polite" role="status" className="mt-2 text-label text-ink-soft">
        {preview
          ? translate(
              'graph.builder.preview',
              String(preview.entities.length),
              String(entities.length),
              String(preview.edges.length),
            )
          : translate('graph.builder.preview.invalid')}
      </p>
    </section>
  )
}
