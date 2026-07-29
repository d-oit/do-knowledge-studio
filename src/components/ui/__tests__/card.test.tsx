import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '../card'

describe('Card', () => {
  it('renders a div with data-slot and base classes', () => {
    render(<Card>Card body</Card>)
    const card = screen.getByText('Card body')
    expect(card.tagName).toBe('DIV')
    expect(card.getAttribute('data-slot')).toBe('card')
    expect(card.className).toContain('rounded-xl')
    expect(card.className).toContain('border')
    expect(card.className).toContain('bg-card')
  })

  it('composes a full card layout with header, content, and footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title text</CardTitle>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
        <CardContent>Content text</CardContent>
        <CardFooter>Footer text</CardFooter>
      </Card>,
    )
    expect(screen.getByText('Title text')).toBeDefined()
    expect(screen.getByText('Description text')).toBeDefined()
    expect(screen.getByText('Content text')).toBeDefined()
    expect(screen.getByText('Footer text')).toBeDefined()
  })

  it('CardHeader sets data-slot and grid layout classes', () => {
    const { container } = render(<CardHeader>Header</CardHeader>)
    const header = container.querySelector('[data-slot="card-header"]')
    expect(header).toBeDefined()
    expect(header?.className).toContain('grid')
    expect(header?.className).toContain('auto-rows-min')
  })

  it('CardTitle renders as a div with semibold class', () => {
    render(<CardTitle>My Title</CardTitle>)
    const title = screen.getByText('My Title')
    expect(title.getAttribute('data-slot')).toBe('card-title')
    expect(title.className).toContain('font-semibold')
  })

  it('CardDescription renders with muted-foreground class', () => {
    render(<CardDescription>Subtitle</CardDescription>)
    const desc = screen.getByText('Subtitle')
    expect(desc.getAttribute('data-slot')).toBe('card-description')
    expect(desc.className).toContain('text-muted-foreground')
    expect(desc.className).toContain('text-sm')
  })

  it('CardAction sets data-slot and grid placement classes', () => {
    const { container } = render(<CardAction>action</CardAction>)
    const action = container.querySelector('[data-slot="card-action"]')
    expect(action).toBeDefined()
    expect(action?.className).toContain('col-start-2')
  })

  it('CardContent sets data-slot and padding class', () => {
    render(<CardContent>Body</CardContent>)
    const content = screen.getByText('Body')
    expect(content.getAttribute('data-slot')).toBe('card-content')
    expect(content.className).toContain('px-6')
  })

  it('CardFooter sets data-slot and flex layout classes', () => {
    render(<CardFooter>Bottom</CardFooter>)
    const footer = screen.getByText('Bottom')
    expect(footer.getAttribute('data-slot')).toBe('card-footer')
    expect(footer.className).toContain('flex')
    expect(footer.className).toContain('items-center')
  })

  it('accepts custom className on Card', () => {
    render(<Card className="my-card">Custom</Card>)
    const card = screen.getByText('Custom')
    expect(card.className).toContain('my-card')
  })
})
