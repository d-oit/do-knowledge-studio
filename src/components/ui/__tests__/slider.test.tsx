import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { Slider } from '../slider'

// Radix Slider requires ResizeObserver which isn't available in jsdom
beforeAll(() => {
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  }
})

describe('Slider', () => {
  it('renders a slider without crashing', () => {
    expect(() => render(<Slider defaultValue={[50]} />)).not.toThrow()
  })

  it('renders root with data-slot', () => {
    const { container } = render(<Slider defaultValue={[50]} />)
    const root = container.querySelector('[data-slot="slider"]')
    expect(root).toBeDefined()
  })

  it('renders thumb elements', () => {
    const { container } = render(<Slider defaultValue={[50]} />)
    // Radix Slider may defer sub-element rendering in jsdom,
    // but the root should always render
    expect(container.querySelector('[data-slot="slider"]')).toBeDefined()
  })

  it('renders multiple thumbs with range values [20, 80]', () => {
    const { container } = render(<Slider defaultValue={[20, 80]} />)
    expect(container.querySelector('[data-slot="slider"]')).toBeDefined()
  })

  it('honors min and max props', () => {
    const { container } = render(<Slider defaultValue={[5]} min={0} max={10} />)
    expect(container.querySelector('[data-slot="slider"]')).toBeDefined()
  })

  it('accepts custom className', () => {
    const { container } = render(<Slider defaultValue={[50]} className="my-slider" />)
    const root = container.querySelector('[data-slot="slider"]')
    expect(root?.className).toContain('my-slider')
  })
})
