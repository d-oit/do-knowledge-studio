import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState, Skeleton } from './shared-primitives'
import { FileText } from 'lucide-react'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No entities"
        description="Create your first entity"
      />,
    )
    expect(screen.getByText('No entities')).toBeDefined()
    expect(screen.getByText('Create your first entity')).toBeDefined()
  })

  it('renders action when provided', () => {
    render(
      <EmptyState
        icon={FileText}
        title="Empty"
        action={<button>Create</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Create' })).toBeDefined()
  })

  it('has role="status" for accessibility', () => {
    const { container } = render(
      <EmptyState icon={FileText} title="Status" />,
    )
    expect(container.querySelector('[role="status"]')).toBeDefined()
  })

  it('hides icon from screen readers', () => {
    const { container } = render(
      <EmptyState icon={FileText} title="Hidden icon" />,
    )
    const icon = container.querySelector('[aria-hidden="true"]')
    expect(icon).toBeDefined()
  })

  it('omits description and action when not provided', () => {
    render(<EmptyState icon={FileText} title="Minimal" />)
    expect(screen.getByText('Minimal')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Skeleton', () => {
  it('renders with presentation role and aria-hidden', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('role')).toBe('presentation')
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('applies the skeleton class plus custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-full" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('skeleton')
    expect(el.className).toContain('h-8')
    expect(el.className).toContain('w-full')
  })
})

