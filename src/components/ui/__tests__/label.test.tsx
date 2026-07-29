import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from '../label'

describe('Label', () => {
  it('renders a label element with children', () => {
    render(<Label>Email address</Label>)
    const label = screen.getByText('Email address')
    expect(label).toBeDefined()
    expect(label.tagName).toBe('LABEL')
    expect(label.getAttribute('data-slot')).toBe('label')
  })

  it('renders with htmlFor attribute', () => {
    render(<Label htmlFor="email-field">Email</Label>)
    const label = screen.getByText('Email')
    expect(label.getAttribute('for')).toBe('email-field')
  })

  it('applies default text and font classes', () => {
    render(<Label>Styled</Label>)
    const label = screen.getByText('Styled')
    expect(label.className).toContain('text-sm')
    expect(label.className).toContain('font-medium')
  })

  it('applies flex and gap classes for inline layout', () => {
    render(<Label>Layout</Label>)
    const label = screen.getByText('Layout')
    expect(label.className).toContain('flex')
    expect(label.className).toContain('items-center')
    expect(label.className).toContain('gap-2')
  })

  it('accepts custom className', () => {
    render(<Label className="my-label">Custom</Label>)
    const label = screen.getByText('Custom')
    expect(label.className).toContain('my-label')
  })

  it('renders nested children elements', () => {
    render(
      <Label>
        <span>Remember me</span>
        <input type="checkbox" />
      </Label>,
    )
    expect(screen.getByText('Remember me')).toBeDefined()
    expect(screen.getByRole('checkbox')).toBeDefined()
  })

  it('associates with input via htmlFor for accessibility', () => {
    render(
      <div>
        <Label htmlFor="test-input">Field label</Label>
        <input id="test-input" type="text" />
      </div>,
    )
    const label = screen.getByText('Field label')
    expect(label.getAttribute('for')).toBe('test-input')
  })
})
