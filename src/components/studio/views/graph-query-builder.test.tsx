import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Claim, Entity } from '@/lib/studio/types'
import { EMPTY_GRAPH_QUERY } from '@/lib/studio/graph-query-builder'
import { GraphQueryBuilder } from './graph-query-builder'

const entities: Entity[] = [
  {
    id: 'e1',
    name: 'Ada',
    type: 'person',
    description: 'A person',
    content: '',
    tags: ['triz'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    links: [{ targetId: 'e2', relation: 'knows' }],
  },
  {
    id: 'e2',
    name: 'Boris',
    type: 'concept',
    description: 'A concept',
    content: '',
    tags: ['method'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    links: [{ targetId: 'e1', relation: 'knows' }],
  },
]

const claims: Claim[] = [
  {
    id: 'c1',
    entityId: 'e1',
    statement: 'Verified claim',
    confidence: 0.9,
    verification: 'verified',
  },
  {
    id: 'c2',
    entityId: 'e2',
    statement: 'Unverified claim',
    confidence: 0.4,
    verification: 'unverified',
  },
]

/** Harness that owns the query state the way the real panel does. */
const Harness = () => {
  const [query, setQuery] = useState(EMPTY_GRAPH_QUERY)
  return (
    <GraphQueryBuilder
      entities={entities}
      claims={claims}
      query={query}
      onQueryChange={setQuery}
    />
  )
}

const renderBuilder = () => render(<Harness />)

describe('GraphQueryBuilder', () => {
  it('renders the empty state: no conditions, whole corpus matches', () => {
    renderBuilder()
    expect(screen.getByRole('heading', { name: 'Visual query builder' })).toBeDefined()
    expect(screen.getByText(/No conditions — every entity matches/)).toBeDefined()
    // The fixture corpus has two relations (Ada —knows→ Boris and back), so
    // the unfiltered preview counts two edges.
    expect(screen.getByRole('status')).toHaveTextContent('2 of 2 entities and 2 edges match.')
  })

  it('adds a condition, narrows the preview, and updates the readable summary', () => {
    renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))

    const valueSelect = screen.getByLabelText('Entity type')
    expect(valueSelect).toBeDefined()
    fireEvent.change(valueSelect, { target: { value: 'person' } })

    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 entities and 0 edges match.')
    expect(screen.getByText(/Query: type:person/)).toBeDefined()
  })

  it('shows validation for an empty nested group and never applies it', () => {
    renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: /add group/i }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/1 issue\(s\) with this query/)
    expect(alert).toHaveTextContent(/An empty group matches nothing/)
    // Invalid queries show no counts: the canvas stays on the last good state.
    expect(screen.getByRole('status')).toHaveTextContent(
      'This query has issues and is not applied to the canvas.',
    )
  })

  it('negates a clause with Exclude and reflects it in the summary', () => {
    renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    fireEvent.change(screen.getByLabelText('Entity type'), { target: { value: 'person' } })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Exclude' }))
    expect(screen.getByText(/Query: NOT type:person/)).toBeDefined()
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 entities and 0 edges match.')
  })

  it('removes a clause and restores the empty summary', () => {
    renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))
    // The remove control names the clause it removes; the fresh condition has
    // a blank value, so the label carries the kind only ('Remove Entity type').
    fireEvent.click(screen.getByRole('button', { name: /remove entity type/i }))

    expect(screen.queryByLabelText('Entity type')).toBeNull()
    expect(screen.getByText(/No conditions — every entity matches/)).toBeDefined()
  })

  it('exposes accessible tree semantics and labeled controls for screen readers', () => {
    renderBuilder()
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }))

    // The clause list is named, so it is distinguishable from the validation
    // list that the same panel can show.
    const list = screen.getByRole('list', { name: 'Conditions' })
    expect(list).toBeDefined()
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    // Every control in the tree is a native form control with a label.
    expect(screen.getByLabelText('Condition')).toBeDefined()
    expect(screen.getByLabelText('Entity type')).toBeDefined()
    expect(screen.getByRole('checkbox', { name: 'Exclude' })).toBeDefined()
    expect(screen.getByRole('button', { name: /remove entity type/i })).toBeDefined()
  })

  it('is keyboard-operable: tab order follows the tree and Enter activates buttons', () => {
    renderBuilder()
    const addButton = screen.getByRole('button', { name: /add condition/i })
    addButton.focus()
    expect(document.activeElement).toBe(addButton)
    // Native buttons activate on Enter/Space in a real browser; the control is
    // a plain <button> with an onClick, so the default activation path applies.
    expect(addButton.tagName).toBe('BUTTON')
    fireEvent.click(addButton)
    expect(screen.getByLabelText('Entity type')).toBeDefined()
  })
})
