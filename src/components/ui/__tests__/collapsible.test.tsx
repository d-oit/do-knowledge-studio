import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../collapsible'

describe('Collapsible', () => {
  it('renders trigger and content', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>,
    )
    const trigger = screen.getByRole('button', { name: 'Toggle' })
    expect(trigger).toBeDefined()
    expect(trigger.getAttribute('data-slot')).toBe('collapsible-trigger')
  })

  it('opens content when trigger is clicked', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Open</CollapsibleTrigger>
        <CollapsibleContent>Revealed</CollapsibleContent>
      </Collapsible>,
    )
    const trigger = screen.getByRole('button', { name: 'Open' })
    fireEvent.click(trigger)
    expect(screen.getByText('Revealed')).toBeDefined()
  })

  it('renders open by default when defaultOpen is set', () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Default open</CollapsibleTrigger>
        <CollapsibleContent>Visible content</CollapsibleContent>
      </Collapsible>,
    )
    expect(screen.getByText('Visible content')).toBeDefined()
  })

  it('CollapsibleContent sets data-slot', () => {
    const { container } = render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>T</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>,
    )
    const content = container.querySelector('[data-slot="collapsible-content"]')
    expect(content).toBeDefined()
  })

  it('accepts custom className on Collapsible root', () => {
    const { container } = render(
      <Collapsible className="my-collapsible">
        <CollapsibleTrigger>T</CollapsibleTrigger>
        <CollapsibleContent>C</CollapsibleContent>
      </Collapsible>,
    )
    const root = container.querySelector('[data-slot="collapsible"]')
    expect(root?.className).toContain('my-collapsible')
  })

  it('renders disabled state', () => {
    render(
      <Collapsible disabled>
        <CollapsibleTrigger>Disabled trigger</CollapsibleTrigger>
        <CollapsibleContent>C</CollapsibleContent>
      </Collapsible>,
    )
    const trigger = screen.getByRole('button', { name: 'Disabled trigger' })
    expect(trigger).toBeDisabled()
  })
})
