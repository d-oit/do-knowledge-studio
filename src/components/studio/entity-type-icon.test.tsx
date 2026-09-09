import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const I = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    FileText: I,
    Lightbulb: I,
    User: I,
    FolderKanban: I,
    Shapes: I,
    Map: I,
  }
})

import { resetCustomEntityTypes, registerEntityType, type EntityTypeDef } from '@/lib/studio/entity-types'
import { EntityIcon } from './entity-type-icon'

afterEach(() => {
  resetCustomEntityTypes()
})

describe('EntityIcon', () => {
  it('maps built-in types to their dedicated icons', () => {
    const { container } = render(
      <>
        <EntityIcon type="note" />
        <EntityIcon type="concept" />
        <EntityIcon type="person" />
        <EntityIcon type="project" />
      </>,
    )
    expect(container.querySelectorAll('[data-testid="icon"]')).toHaveLength(4)
  })

  it('uses the icon registered for a custom type', () => {
    const Icon = vi.fn((props: { className?: string }) => (
      <span data-testid="custom-icon" {...props} />
    ))
    registerEntityType({
      id: 'roadmap',
      label: 'Roadmap',
      color: 'violet',
      bg: 'bg-violet-100',
      text: 'text-violet-700',
      dot: 'bg-violet-500',
      icon: Icon as unknown as EntityTypeDef['icon'],
    })
    render(<EntityIcon type="roadmap" className="h-4 w-4" />)
    expect(screen.getByTestId('custom-icon')).toBeDefined()
    expect(Icon.mock.calls[0]?.[0]).toEqual({ className: 'h-4 w-4' })
  })

  it('falls back to the neutral icon for a custom type without an icon', () => {
    registerEntityType({
      id: 'milestone',
      label: 'Milestone',
      color: 'clay',
      bg: 'bg-rose-100',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
    })
    const { container } = render(<EntityIcon type="milestone" />)
    expect(container.querySelectorAll('[data-testid="icon"]')).toHaveLength(1)
  })

  it('renders the neutral fallback for unknown types without crashing', () => {
    const { container } = render(<EntityIcon type="foreign-type" />)
    expect(container.querySelectorAll('[data-testid="icon"]')).toHaveLength(1)
  })

  it('passes className through to the rendered icon', () => {
    const { container } = render(<EntityIcon type="note" className="h-5 w-5" />)
    const icon = container.querySelector('[data-testid="icon"]')
    expect(icon?.getAttribute('class')).toContain('h-5 w-5')
  })
})