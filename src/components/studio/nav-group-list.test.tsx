import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavGroupList } from './nav-group-list'

describe('NavGroupList', () => {
  it('renders each shared navigation group and its items in list structure', () => {
    render(
      <NavGroupList
        groups={[
          { label: 'Explore', items: [{ id: 'graph', label: 'Graph' }, { id: 'map', label: 'Mind map' }] },
          { label: 'Capture', items: [{ id: 'editor', label: 'Editor' }] },
        ]}
        className="navigation"
        groupClassName="group"
      >
        {(item) => <li key={item.id}><button type="button">{item.label}</button></li>}
      </NavGroupList>,
    )

    expect(screen.getByText('Explore')).toBeTruthy()
    expect(screen.getByText('Capture')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Graph' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mind map' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Editor' })).toBeTruthy()
    expect(screen.getAllByRole('list')).toHaveLength(2)
  })
})
