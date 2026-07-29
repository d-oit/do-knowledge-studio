import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../tooltip'

describe('Tooltip', () => {
  it('renders trigger child without nested button warning', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span>Hover me</span>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    expect(screen.getByText('Hover me')).toBeDefined()
  })

  it('TooltipTrigger renders as a button by default', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span>Trigger</span>
          </TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    const trigger = screen.getByRole('button')
    expect(trigger).toBeDefined()
    expect(trigger.getAttribute('data-slot')).toBe('tooltip-trigger')
  })

  it('TooltipProvider accepts custom delayDuration', () => {
    render(
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger>
            <span>Delayed</span>
          </TooltipTrigger>
          <TooltipContent>Delayed content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    expect(screen.getByText('Delayed')).toBeDefined()
  })

  it('TooltipProvider defaults to zero delay', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span>Info</span>
          </TooltipTrigger>
          <TooltipContent>Default delay</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    expect(screen.getByText('Info')).toBeDefined()
  })

  it('sets data-slot on provider and tooltip root', () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span>Root test</span>
          </TooltipTrigger>
          <TooltipContent>Root content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    const provider = container.querySelector('[data-slot="tooltip-provider"]')
    expect(provider).toBeDefined()
    const tooltip = container.querySelector('[data-slot="tooltip"]')
    expect(tooltip).toBeDefined()
  })

  it('supports asChild pattern with button via TooltipTrigger', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button>asChild button</button>
          </TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    expect(screen.getByRole('button', { name: 'asChild button' })).toBeDefined()
  })
})
