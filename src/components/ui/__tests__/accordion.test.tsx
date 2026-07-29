import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../accordion'

describe('Accordion', () => {
  it('renders accordion items with triggers', () => {
    render(
      <Accordion type="single">
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Content for section 1</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const trigger = screen.getByRole('button', { name: /section 1/i })
    expect(trigger).toBeDefined()
    expect(trigger.getAttribute('data-slot')).toBe('accordion-trigger')
  })

  it('opens content when trigger is clicked', () => {
    render(
      <Accordion type="single">
        <AccordionItem value="item-1">
          <AccordionTrigger>Toggle me</AccordionTrigger>
          <AccordionContent>Hidden content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const trigger = screen.getByRole('button', { name: /toggle me/i })
    expect(trigger.getAttribute('data-state')).toBe('closed')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('data-state')).toBe('open')
  })

  it('renders content with data-slot when open', () => {
    render(
      <Accordion type="single" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Always open</AccordionTrigger>
          <AccordionContent>Visible content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    expect(screen.getByText('Visible content')).toBeDefined()
    const content = screen.getByText('Visible content').closest('[data-slot="accordion-content"]')
    expect(content).toBeDefined()
  })

  it('AccordionItem sets data-slot and border classes', () => {
    const { container } = render(
      <Accordion type="single">
        <AccordionItem value="i">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionContent>C</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const item = container.querySelector('[data-slot="accordion-item"]')
    expect(item).toBeDefined()
    expect(item?.className).toContain('border-b')
  })

  it('AccordionTrigger applies flex and font classes', () => {
    render(
      <Accordion type="single">
        <AccordionItem value="i">
          <AccordionTrigger>Styled trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const trigger = screen.getByRole('button', { name: /styled trigger/i })
    expect(trigger.className).toContain('flex')
    expect(trigger.className).toContain('font-medium')
    expect(trigger.className).toContain('text-sm')
  })

  it('renders chevron icon in trigger', () => {
    render(
      <Accordion type="single">
        <AccordionItem value="i">
          <AccordionTrigger>With icon</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const trigger = screen.getByRole('button', { name: /with icon/i })
    const svg = trigger.querySelector('svg')
    expect(svg).toBeDefined()
  })

  it('supports collapsible single accordion', () => {
    render(
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Collapsible</AccordionTrigger>
          <AccordionContent>Can close me</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const trigger = screen.getByRole('button', { name: /collapsible/i })
    expect(trigger.getAttribute('data-state')).toBe('open')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('data-state')).toBe('closed')
  })

  it('accepts custom className on AccordionItem', () => {
    const { container } = render(
      <Accordion type="single">
        <AccordionItem value="i" className="my-item">
          <AccordionTrigger>T</AccordionTrigger>
          <AccordionContent>C</AccordionContent>
        </AccordionItem>
      </Accordion>,
    )
    const item = container.querySelector('[data-slot="accordion-item"]')
    expect(item?.className).toContain('my-item')
  })
})
