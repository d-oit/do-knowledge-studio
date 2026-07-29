import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AspectRatio } from '../aspect-ratio'

describe('AspectRatio', () => {
  it('renders a div with data-slot', () => {
    const { container } = render(<AspectRatio ratio={16 / 9}>Content</AspectRatio>)
    const el = container.querySelector('[data-slot="aspect-ratio"]')
    expect(el).toBeDefined()
    expect(el?.tagName).toBe('DIV')
  })

  it('renders children', () => {
    const { container } = render(
      <AspectRatio ratio={1}>
        <span>Child content</span>
      </AspectRatio>,
    )
    const child = container.querySelector('span')
    expect(child).toBeDefined()
    expect(child?.textContent).toBe('Child content')
  })

  it('accepts ratio prop', () => {
    const { container } = render(
      <AspectRatio ratio={4 / 3}>
        <span>4:3</span>
      </AspectRatio>,
    )
    const el = container.querySelector('[data-slot="aspect-ratio"]')
    expect(el).toBeDefined()
  })

  it('accepts custom className', () => {
    const { container } = render(
      <AspectRatio ratio={1} className="my-aspect">
        <span>Custom</span>
      </AspectRatio>,
    )
    const el = container.querySelector('[data-slot="aspect-ratio"]')
    expect(el?.className).toContain('my-aspect')
  })

  it('works with 1:1 ratio', () => {
    const { container } = render(
      <AspectRatio ratio={1}>
        <span>Square</span>
      </AspectRatio>,
    )
    expect(container.querySelector('[data-slot="aspect-ratio"]')).toBeDefined()
  })

  it('works with 21:9 ratio', () => {
    const { container } = render(
      <AspectRatio ratio={21 / 9}>
        <span>Ultrawide</span>
      </AspectRatio>,
    )
    expect(container.querySelector('[data-slot="aspect-ratio"]')).toBeDefined()
  })
})
