import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from '../switch'

describe('Switch', () => {
  it('renders a switch role element', () => {
    render(<Switch aria-label="notifications" />)
    const switchEl = screen.getByRole('switch', { name: 'notifications' })
    expect(switchEl).toBeDefined()
    expect(switchEl.getAttribute('data-slot')).toBe('switch')
  })

  it('renders unchecked by default', () => {
    render(<Switch aria-label="default-sw" />)
    const switchEl = screen.getByRole('switch', { name: 'default-sw' })
    expect(switchEl.getAttribute('data-state')).toBe('unchecked')
  })

  it('renders checked when defaultChecked', () => {
    render(<Switch defaultChecked aria-label="on-sw" />)
    const switchEl = screen.getByRole('switch', { name: 'on-sw' })
    expect(switchEl.getAttribute('data-state')).toBe('checked')
  })

  it('meets the 44x44 touch-target minimum and pill shape', () => {
    render(<Switch aria-label="styled-sw" />)
    const switchEl = screen.getByRole('switch', { name: 'styled-sw' })
    // Hit area: the interactive element itself must be 44x44 (WCAG 2.5.5).
    expect(switchEl.className).toContain('h-11')
    expect(switchEl.className).toContain('w-11')
    expect(switchEl.className).toContain('rounded-full')
  })

  it('renders a thumb element with data-slot', () => {
    const { container } = render(<Switch aria-label="thumb-sw" />)
    const thumb = container.querySelector('[data-slot="switch-thumb"]')
    expect(thumb).toBeDefined()
    expect(thumb?.className).toContain('rounded-full')
  })

  it('renders in disabled state', () => {
    render(<Switch disabled aria-label="disabled-sw" />)
    const switchEl = screen.getByRole('switch', { name: 'disabled-sw' })
    expect(switchEl).toBeDisabled()
    expect(switchEl.className).toContain('disabled:opacity-50')
  })

  it('applies checked background class', () => {
    render(<Switch aria-label="bg-sw" />)
    const switchEl = screen.getByRole('switch', { name: 'bg-sw' })
    // The checked track style lives on the nested track span
    // (group-data-[state=checked]), not the hit-area button.
    expect(switchEl.className).toContain('group')
    const track = switchEl.querySelector('[data-slot="switch-thumb"]')?.parentElement
    expect(track?.className).toContain('group-data-[state=checked]:bg-primary')
  })

  it('accepts custom className', () => {
    render(<Switch className="my-switch" aria-label="custom-sw" />)
    const switchEl = screen.getByRole('switch', { name: 'custom-sw' })
    expect(switchEl.className).toContain('my-switch')
  })

  it('toggles state on click', () => {
    render(<Switch aria-label="toggle-sw" />)
    const switchEl = screen.getByRole('switch', { name: 'toggle-sw' })
    expect(switchEl.getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(switchEl)
    expect(switchEl.getAttribute('data-state')).toBe('checked')
  })
})
