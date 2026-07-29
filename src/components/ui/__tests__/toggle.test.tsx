import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toggle } from '../toggle'

describe('Toggle', () => {
  it('renders a toggle button', () => {
    render(<Toggle>Toggle me</Toggle>)
    const toggle = screen.getByRole('button', { name: 'Toggle me' })
    expect(toggle).toBeDefined()
    expect(toggle.getAttribute('data-slot')).toBe('toggle')
  })

  it('renders unpressed by default', () => {
    render(<Toggle>Default</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle.getAttribute('data-state')).toBe('off')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders pressed via defaultPressed prop', () => {
    render(<Toggle defaultPressed>Pressed</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle.getAttribute('data-state')).toBe('on')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('applies default variant classes', () => {
    render(<Toggle>Default variant</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle.className).toContain('bg-transparent')
    expect(toggle.className).toContain('h-9')
  })

  it('applies outline variant classes', () => {
    render(<Toggle variant="outline">Outline</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle.className).toContain('border')
    expect(toggle.className).toContain('border-input')
    expect(toggle.className).toContain('bg-transparent')
  })

  it('applies sm size classes', () => {
    render(<Toggle size="sm">Small</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle.className).toContain('h-8')
    expect(toggle.className).toContain('px-1.5')
  })

  it('applies lg size classes', () => {
    render(<Toggle size="lg">Large</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle.className).toContain('h-10')
    expect(toggle.className).toContain('px-2.5')
  })

  it('renders in disabled state', () => {
    render(<Toggle disabled>Disabled</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle).toBeDisabled()
  })

  it('combines disabled and pressed states', () => {
    render(
      <Toggle disabled defaultPressed>
        Disabled pressed
      </Toggle>,
    )
    const toggle = screen.getByRole('button')
    expect(toggle).toBeDisabled()
    expect(toggle.getAttribute('data-state')).toBe('on')
  })

  it('accepts custom className', () => {
    render(<Toggle className="my-custom">Custom</Toggle>)
    const toggle = screen.getByRole('button')
    expect(toggle.className).toContain('my-custom')
  })
})
