import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Separator } from '../separator'

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(<Separator />)
    const sep = container.querySelector('[data-slot="separator"]')
    expect(sep).toBeDefined()
    expect(sep?.getAttribute('data-orientation')).toBe('horizontal')
  })

  it('applies horizontal layout classes by default', () => {
    const { container } = render(<Separator />)
    const sep = container.querySelector('[data-slot="separator"]')
    expect(sep?.className).toContain('data-[orientation=horizontal]:h-px')
    expect(sep?.className).toContain('data-[orientation=horizontal]:w-full')
  })

  it('renders vertical separator when orientation="vertical"', () => {
    const { container } = render(<Separator orientation="vertical" />)
    const sep = container.querySelector('[data-slot="separator"]')
    expect(sep?.getAttribute('data-orientation')).toBe('vertical')
    expect(sep?.className).toContain('data-[orientation=vertical]:h-full')
    expect(sep?.className).toContain('data-[orientation=vertical]:w-px')
  })

  it('is decorative by default', () => {
    const { container } = render(<Separator />)
    const sep = container.querySelector('[data-slot="separator"]')
    expect(sep?.getAttribute('role')).toBe('none')
  })

  it('exposes separator role when decorative is false', () => {
    const { container } = render(<Separator decorative={false} />)
    const sep = container.querySelector('[data-slot="separator"]')
    expect(sep?.getAttribute('role')).toBe('separator')
  })

  it('applies bg-border class for visible line', () => {
    const { container } = render(<Separator />)
    const sep = container.querySelector('[data-slot="separator"]')
    expect(sep?.className).toContain('bg-border')
  })

  it('accepts custom className', () => {
    const { container } = render(<Separator className="my-sep" />)
    const sep = container.querySelector('[data-slot="separator"]')
    expect(sep?.className).toContain('my-sep')
  })
})
