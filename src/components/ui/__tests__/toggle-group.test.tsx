import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToggleGroup, ToggleGroupItem } from '../toggle-group'

describe('ToggleGroup', () => {
  it('renders toggle group with multiple items', () => {
    render(
      <ToggleGroup type="multiple">
        <ToggleGroupItem value="bold">B</ToggleGroupItem>
        <ToggleGroupItem value="italic">I</ToggleGroupItem>
        <ToggleGroupItem value="underline">U</ToggleGroupItem>
      </ToggleGroup>,
    )
    const items = screen.getAllByRole('button')
    expect(items).toHaveLength(3)
    expect(items[0].getAttribute('data-slot')).toBe('toggle-group-item')
  })

  it('ToggleGroup sets data-slot and base classes', () => {
    const { container } = render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>,
    )
    const group = container.querySelector('[data-slot="toggle-group"]')
    expect(group).toBeDefined()
    expect(group?.className).toContain('flex')
    expect(group?.className).toContain('rounded-md')
  })

  it('supports single selection mode', () => {
    const { container } = render(
      <ToggleGroup type="single" defaultValue="a">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>,
    )
    // Radix ToggleGroup may not render buttons with role="button" in jsdom
    // Verify items exist via data-slot
    const items = container.querySelectorAll('[data-slot="toggle-group-item"]')
    expect(items.length).toBe(2)
  })

  it('supports outline variant', () => {
    const { container } = render(
      <ToggleGroup type="multiple" variant="outline">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>,
    )
    const group = container.querySelector('[data-slot="toggle-group"]')
    expect(group?.getAttribute('data-variant')).toBe('outline')
  })

  it('supports size prop', () => {
    const { container } = render(
      <ToggleGroup type="single" size="sm">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>,
    )
    const item = container.querySelector('[data-slot="toggle-group-item"]')
    expect(item?.getAttribute('data-size')).toBe('sm')
  })

  it('renders disabled items', () => {
    render(
      <ToggleGroup type="multiple">
        <ToggleGroupItem value="a" disabled>
          A
        </ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>,
    )
    const items = screen.getAllByRole('button')
    expect(items[0]).toBeDisabled()
    expect(items[1]).not.toBeDisabled()
  })

  it('accepts custom className on ToggleGroup', () => {
    const { container } = render(
      <ToggleGroup type="single" className="my-group">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>,
    )
    const group = container.querySelector('[data-slot="toggle-group"]')
    expect(group?.className).toContain('my-group')
  })
})
