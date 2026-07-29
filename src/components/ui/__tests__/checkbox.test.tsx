import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Checkbox } from '../checkbox'

describe('Checkbox', () => {
  it('renders a checkbox role element', () => {
    render(<Checkbox aria-label="accept" />)
    const checkbox = screen.getByRole('checkbox', { name: 'accept' })
    expect(checkbox).toBeDefined()
    expect(checkbox.getAttribute('data-slot')).toBe('checkbox')
  })

  it('renders unchecked by default', () => {
    render(<Checkbox aria-label="terms" />)
    const checkbox = screen.getByRole('checkbox', { name: 'terms' })
    expect(checkbox.getAttribute('data-state')).toBe('unchecked')
  })

  it('renders checked when defaultChecked', () => {
    render(<Checkbox defaultChecked aria-label="confirmed" />)
    const checkbox = screen.getByRole('checkbox', { name: 'confirmed' })
    expect(checkbox.getAttribute('data-state')).toBe('checked')
  })

  it('applies default border and size classes', () => {
    render(<Checkbox aria-label="styled" />)
    const checkbox = screen.getByRole('checkbox', { name: 'styled' })
    expect(checkbox.className).toContain('size-4')
    expect(checkbox.className).toContain('border')
    expect(checkbox.className).toContain('rounded-[4px]')
  })

  it('renders checked indicator with primary background', () => {
    render(<Checkbox defaultChecked aria-label="indicator" />)
    const checkbox = screen.getByRole('checkbox', { name: 'indicator' })
    expect(checkbox.className).toContain('data-[state=checked]:bg-primary')
  })

  it('renders in disabled state', () => {
    render(<Checkbox disabled aria-label="disabled-cb" />)
    const checkbox = screen.getByRole('checkbox', { name: 'disabled-cb' })
    expect(checkbox).toBeDisabled()
    expect(checkbox.className).toContain('disabled:opacity-50')
  })

  it('applies focus-visible ring classes', () => {
    render(<Checkbox aria-label="focus-test" />)
    const checkbox = screen.getByRole('checkbox', { name: 'focus-test' })
    expect(checkbox.className).toContain('focus-visible:ring')
  })

  it('accepts custom className', () => {
    render(<Checkbox className="my-checkbox" aria-label="custom-cb" />)
    const checkbox = screen.getByRole('checkbox', { name: 'custom-cb' })
    expect(checkbox.className).toContain('my-checkbox')
  })

  it('toggles state on click', () => {
    render(<Checkbox aria-label="toggle-cb" />)
    const checkbox = screen.getByRole('checkbox', { name: 'toggle-cb' })
    expect(checkbox.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(checkbox)
    expect(checkbox.getAttribute('data-state')).toBe('checked')
  })
})
