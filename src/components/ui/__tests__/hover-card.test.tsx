import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../hover-card'

describe('HoverCard', () => {
  it('renders trigger element with data-slot', () => {
    render(
      <HoverCard>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
        <HoverCardContent>Card content</HoverCardContent>
      </HoverCard>,
    )
    const trigger = screen.getByText('Hover me')
    expect(trigger).toBeDefined()
    expect(trigger.getAttribute('data-slot')).toBe('hover-card-trigger')
  })

  it('renders content when defaultOpen', () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>T</HoverCardTrigger>
        <HoverCardContent>Visible hover content</HoverCardContent>
      </HoverCard>,
    )
    expect(screen.getByText('Visible hover content')).toBeDefined()
  })

  it('HoverCardContent sets data-slot and base classes', () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>T</HoverCardTrigger>
        <HoverCardContent>Styled</HoverCardContent>
      </HoverCard>,
    )
    const content = document.querySelector('[data-slot="hover-card-content"]')
    expect(content).toBeDefined()
    expect(content?.className).toContain('rounded-md')
    expect(content?.className).toContain('border')
    expect(content?.className).toContain('bg-popover')
  })

  it('HoverCardContent accepts custom className', () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>T</HoverCardTrigger>
        <HoverCardContent className="my-hover-content">Custom</HoverCardContent>
      </HoverCard>,
    )
    const content = document.querySelector('[data-slot="hover-card-content"]')
    expect(content?.className).toContain('my-hover-content')
  })

  it('supports align and sideOffset props', () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>T</HoverCardTrigger>
        <HoverCardContent align="start" sideOffset={10}>
          Aligned hover
        </HoverCardContent>
      </HoverCard>,
    )
    expect(screen.getByText('Aligned hover')).toBeDefined()
  })
})
