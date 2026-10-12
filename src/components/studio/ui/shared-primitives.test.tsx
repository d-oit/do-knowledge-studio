import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Skeleton,
  Overlay,
  ViewEmptyState,
  ViewHeader,
  VIEW_CONTAINER_CLASS,
} from './shared-primitives'
import { FileText } from 'lucide-react'
import { createRef } from 'react'

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

describe('Overlay', () => {
  it('renders with dialog role and aria-modal when open', () => {
    render(
      <Overlay open onClose={() => undefined} aria-label="Test dialog">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Test dialog')
  })

  it('does not render when closed', () => {
    render(
      <Overlay open={false} onClose={() => undefined} aria-label="Hidden">
        <p>Content</p>
      </Overlay>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Overlay open onClose={onClose} aria-label="Escape test">
        <p>Content</p>
      </Overlay>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose on Escape when closeOnEscape is false', () => {
    const onClose = vi.fn()
    render(
      <Overlay open onClose={onClose} closeOnEscape={false} aria-label="No escape">
        <p>Content</p>
      </Overlay>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Overlay open onClose={onClose} aria-label="Backdrop test">
        <p>Content</p>
      </Overlay>,
    )
    // Backdrop is the outermost fixed div (first child of container)
    const backdrop = container.firstElementChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when child is clicked', () => {
    const onClose = vi.fn()
    render(
      <Overlay open onClose={onClose} aria-label="Child click test">
        <button>Click me</button>
      </Overlay>,
    )
    fireEvent.click(screen.getByText('Click me'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onClose on backdrop click when closeOnBackdrop is false', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Overlay open onClose={onClose} closeOnBackdrop={false} aria-label="No backdrop">
        <p>Content</p>
      </Overlay>,
    )
    const backdrop = container.firstElementChild as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('supports aria-labelledby', () => {
    render(
      <Overlay open onClose={() => undefined} aria-labelledby="title-id">
        <h3 id="title-id">Dialog Title</h3>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-labelledby')).toBe('title-id')
  })

  it('applies custom className', () => {
    render(
      <Overlay open onClose={() => undefined} aria-label="Custom class" className="custom-overlay">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('custom-overlay')
  })

  it('uses initialFocusRef when provided', () => {
    const inputRef = createRef<HTMLInputElement>()
    render(
      <Overlay open onClose={() => undefined} aria-label="Focus test" initialFocusRef={inputRef}>
        <input ref={inputRef} data-testid="target-input" />
      </Overlay>,
    )
    expect(document.activeElement).toBe(inputRef.current)
  })

  it('defaults to center variant', () => {
    render(
      <Overlay open onClose={() => undefined} aria-label="Default variant">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('m-auto')
    expect(dialog.className).toContain('rounded-xl')
  })

  it('applies sheet-bottom variant classes', () => {
    render(
      <Overlay open onClose={() => undefined} variant="sheet-bottom" aria-label="Sheet bottom">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('mt-auto')
    expect(dialog.className).toContain('rounded-t-xl')
  })

  it('applies sheet-left variant classes', () => {
    render(
      <Overlay open onClose={() => undefined} variant="sheet-left" aria-label="Sheet left">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('h-dvh')
    expect(dialog.className).toContain('w-[min(86vw,340px)]')
  })

  it('applies fullscreen variant classes', () => {
    render(
      <Overlay open onClose={() => undefined} variant="fullscreen" aria-label="Fullscreen">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('h-full')
    expect(dialog.className).toContain('w-full')
  })

  it('scroll lock is applied when open', () => {
    render(
      <Overlay open onClose={() => undefined} aria-label="Scroll lock test">
        <p>Content</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('scroll lock is removed when closed', () => {
    const { rerender } = render(
      <Overlay open onClose={() => undefined} aria-label="Scroll lock cleanup">
        <p>Content</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <Overlay open={false} onClose={() => undefined} aria-label="Scroll lock cleanup">
        <p>Content</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('')
  })

  it('traps focus with Tab key — cycles from last to first', () => {
    render(
      <Overlay open onClose={() => undefined} aria-label="Focus trap test">
        <button data-testid="first">First</button>
        <button data-testid="last">Last</button>
      </Overlay>,
    )
    const last = screen.getByTestId('last')
    const first = screen.getByTestId('first')
    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('traps focus with Shift+Tab — cycles from first to last', () => {
    render(
      <Overlay open onClose={() => undefined} aria-label="Focus trap shift test">
        <button data-testid="first">First</button>
        <button data-testid="last">Last</button>
      </Overlay>,
    )
    const first = screen.getByTestId('first')
    const last = screen.getByTestId('last')
    first.focus()
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})

describe('VIEW_CONTAINER_CLASS', () => {
  it('carries the shared gutter and vertical rhythm', () => {
    expect(VIEW_CONTAINER_CLASS).toContain('px-6')
    expect(VIEW_CONTAINER_CLASS).toContain('lg:px-10')
    expect(VIEW_CONTAINER_CLASS).toContain('py-6')
    expect(VIEW_CONTAINER_CLASS).toContain('lg:py-8')
    expect(VIEW_CONTAINER_CLASS).toContain('mx-auto')
  })
})

describe('ViewHeader', () => {
  it('renders the view identity as an h2 — the shell owns the h1', () => {
    render(<ViewHeader icon={FileText} title="Library" subtitle="Everything you captured" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeDefined()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByText('Everything you captured')).toBeDefined()
  })

  it('renders the badge and action slots', () => {
    render(
      <ViewHeader
        icon={FileText}
        title="AI Harness"
        badge={<span>Lab</span>}
        action={<button>Show settings</button>}
      />,
    )
    expect(screen.getByText('Lab')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Show settings' })).toBeDefined()
  })

  it('omits the subtitle paragraph when none is given', () => {
    const { container } = render(<ViewHeader icon={FileText} title="Graph" />)
    expect(container.querySelectorAll('header p')).toHaveLength(0)
  })
})

describe('ViewEmptyState', () => {
  it('renders the headline, body, and a 44px primary action', () => {
    render(
      <ViewEmptyState
        icon={FileText}
        title="Nothing to graph yet"
        body="Create your first entity"
        actionLabel="Create entity"
        onAction={() => undefined}
      />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Nothing to graph yet' })).toBeDefined()
    expect(screen.getByText('Create your first entity')).toBeDefined()
    const action = screen.getByRole('button', { name: 'Create entity' })
    expect(action.className).toContain('min-h-[44px]')
  })

  it('runs the create action when it is activated', () => {
    const onAction = vi.fn()
    render(
      <ViewEmptyState
        icon={FileText}
        title="Nothing to map yet"
        body="Add entities with links"
        actionLabel="Create entity"
        onAction={onAction}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create entity' }))
    expect(onAction).toHaveBeenCalledOnce()
  })
})

