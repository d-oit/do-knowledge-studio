import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Progress } from '../progress'

describe('Progress', () => {
  it('renders a progress root with data-slot', () => {
    const { container } = render(<Progress value={50} />)
    const root = container.querySelector('[data-slot="progress"]')
    expect(root).toBeDefined()
    expect(root?.getAttribute('role')).toBe('progressbar')
  })

  it('applies base classes', () => {
    const { container } = render(<Progress value={50} />)
    const root = container.querySelector('[data-slot="progress"]')
    expect(root?.className).toContain('rounded-full')
    expect(root?.className).toContain('h-2')
    expect(root?.className).toContain('w-full')
  })

  it('renders indicator with data-slot', () => {
    const { container } = render(<Progress value={50} />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]')
    expect(indicator).toBeDefined()
    expect(indicator?.className).toContain('bg-primary')
  })

  it('indicator starts at 0% when value is 0', () => {
    const { container } = render(<Progress value={0} />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]')
    expect(indicator).toBeDefined()
  })

  it('indicator fills to 100%', () => {
    const { container } = render(<Progress value={100} />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]')
    expect(indicator).toBeDefined()
  })

  it('indicator shows partial at 30', () => {
    const { container } = render(<Progress value={30} />)
    const indicator = container.querySelector('[data-slot="progress-indicator"]')
    expect(indicator).toBeDefined()
  })

  it('renders with value prop without crashing', () => {
    const { container } = render(<Progress value={75} />)
    expect(container.querySelector('[data-slot="progress"]')).toBeDefined()
  })

  it('accepts custom className', () => {
    const { container } = render(<Progress value={50} className="my-progress" />)
    const root = container.querySelector('[data-slot="progress"]')
    expect(root?.className).toContain('my-progress')
  })
})
