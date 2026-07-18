import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import {
  Skeleton,
  EntityCardSkeleton,
  ListSkeleton,
  GraphSkeleton,
  ChatSkeleton,
} from './skeleton'

let mockReduced = false

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => mockReduced,
}))

beforeEach(() => {
  mockReduced = false
})

describe('Skeleton', () => {
  it('renders with skeleton class and presentation role', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('role')).toBe('presentation')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toContain('skeleton')
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('w-20')
  })

  it('renders without custom className', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('skeleton')
  })
})

describe('EntityCardSkeleton', () => {
  it('renders expected structure', () => {
    const { container } = render(<EntityCardSkeleton />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.getAttribute('role')).toBe('presentation')
    const skeletons = root.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
  })

  it('disables animation when reduced motion is enabled', () => {
    mockReduced = true
    const { container } = render(<EntityCardSkeleton />)
    const root = container.firstChild as HTMLElement
    const animated = root.querySelectorAll('.animate-none')
    expect(animated.length).toBeGreaterThan(0)
  })
})

describe('ListSkeleton', () => {
  it('renders correct number of items', () => {
    const { container } = render(<ListSkeleton count={3} />)
    const items = container.querySelectorAll('[class*="rounded-lg"][class*="border"]')
    expect(items.length).toBe(3)
  })

  it('defaults to 5 items', () => {
    const { container } = render(<ListSkeleton />)
    const items = container.querySelectorAll('[class*="rounded-lg"][class*="border"]')
    expect(items.length).toBe(5)
  })
})

describe('GraphSkeleton', () => {
  it('renders skeleton circles and lines', () => {
    const { container } = render(<GraphSkeleton />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    const skeletons = root.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ChatSkeleton', () => {
  it('renders alternating message bubbles', () => {
    const { container } = render(<ChatSkeleton />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('aria-hidden')).toBe('true')
    const bubbles = root.querySelectorAll('.rounded-xl')
    expect(bubbles.length).toBe(4)
  })
})
