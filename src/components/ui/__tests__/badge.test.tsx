import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'

describe('Badge', () => {
  it('renders a span with children by default', () => {
    render(<Badge>New</Badge>)
    const badge = screen.getByText('New')
    expect(badge).toBeDefined()
    expect(badge.tagName).toBe('SPAN')
    expect(badge.getAttribute('data-slot')).toBe('badge')
  })

  it('renders default variant classes', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge.className).toContain('bg-primary')
    expect(badge.className).toContain('text-primary-foreground')
  })

  it('applies secondary variant classes', () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    const badge = screen.getByText('Secondary')
    expect(badge.className).toContain('bg-secondary')
    expect(badge.className).toContain('text-secondary-foreground')
  })

  it('applies destructive variant classes', () => {
    render(<Badge variant="destructive">Error</Badge>)
    const badge = screen.getByText('Error')
    expect(badge.className).toContain('bg-destructive')
    expect(badge.className).toContain('text-white')
  })

  it('applies outline variant classes', () => {
    render(<Badge variant="outline">Outlined</Badge>)
    const badge = screen.getByText('Outlined')
    expect(badge.className).toContain('text-foreground')
  })

  it('renders with base rounded and size classes', () => {
    render(<Badge>Base</Badge>)
    const badge = screen.getByText('Base')
    expect(badge.className).toContain('rounded-md')
    expect(badge.className).toContain('text-xs')
    expect(badge.className).toContain('px-2')
  })

  it('renders asChild as the child element (anchor)', () => {
    render(
      <Badge asChild>
        <a href="/tags">Linked badge</a>
      </Badge>,
    )
    const link = screen.getByRole('link', { name: 'Linked badge' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/tags')
    expect(link.getAttribute('data-slot')).toBe('badge')
  })

  it('accepts custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge.className).toContain('custom-badge')
  })

  it('renders icon child element', () => {
    render(
      <Badge>
        <svg data-testid="icon" aria-hidden="true" />
        With icon
      </Badge>,
    )
    expect(screen.getByTestId('icon')).toBeDefined()
    expect(screen.getByText('With icon')).toBeDefined()
  })
})
