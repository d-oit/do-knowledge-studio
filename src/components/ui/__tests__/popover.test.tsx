import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Popover, PopoverTrigger, PopoverContent } from '../popover'

describe('Popover', () => {
  it('renders trigger element', () => {
    render(
      <Popover>
        <PopoverTrigger>Open popover</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>,
    )
    const trigger = screen.getByRole('button', { name: 'Open popover' })
    expect(trigger).toBeDefined()
    expect(trigger.getAttribute('data-slot')).toBe('popover-trigger')
  })

  it('renders content when defaultOpen', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Visible content</PopoverContent>
      </Popover>,
    )
    expect(screen.getByText('Visible content')).toBeDefined()
  })

  it('PopoverContent sets data-slot and base classes', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>T</PopoverTrigger>
        <PopoverContent>Styled content</PopoverContent>
      </Popover>,
    )
    const content = document.querySelector('[data-slot="popover-content"]')
    expect(content).toBeDefined()
    expect(content?.className).toContain('rounded-md')
    expect(content?.className).toContain('border')
    expect(content?.className).toContain('bg-popover')
  })

  it('PopoverContent accepts custom className', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>T</PopoverTrigger>
        <PopoverContent className="my-popover-content">Custom</PopoverContent>
      </Popover>,
    )
    const content = document.querySelector('[data-slot="popover-content"]')
    expect(content?.className).toContain('my-popover-content')
  })

  it('supports align and sideOffset props', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>T</PopoverTrigger>
        <PopoverContent align="start" sideOffset={8}>
          Aligned
        </PopoverContent>
      </Popover>,
    )
    expect(screen.getByText('Aligned')).toBeDefined()
  })
})
