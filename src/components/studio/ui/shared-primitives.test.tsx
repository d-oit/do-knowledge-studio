import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState, Skeleton, Overlay } from './shared-primitives'
import { FileText } from 'lucide-react'
import { createRef } from 'react'

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

describe('Overlay', () => {
  it('renders with dialog role and aria-modal when open', () => {
    render(
      <Overlay open onClose={() => {}} aria-label="Test dialog">
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
      <Overlay open={false} onClose={() => {}} aria-label="Hidden">
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
      <Overlay open onClose={() => {}} aria-labelledby="title-id">
        <h3 id="title-id">Dialog Title</h3>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-labelledby')).toBe('title-id')
  })

  it('applies custom className', () => {
    render(
      <Overlay open onClose={() => {}} aria-label="Custom class" className="custom-overlay">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('custom-overlay')
  })

  it('uses initialFocusRef when provided', () => {
    const inputRef = createRef<HTMLInputElement>()
    render(
      <Overlay open onClose={() => {}} aria-label="Focus test" initialFocusRef={inputRef}>
        <input ref={inputRef} data-testid="target-input" />
      </Overlay>,
    )
    expect(document.activeElement).toBe(inputRef.current)
  })

  it('defaults to center variant', () => {
    render(
      <Overlay open onClose={() => {}} aria-label="Default variant">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('m-auto')
    expect(dialog.className).toContain('rounded-xl')
  })

  it('applies sheet-bottom variant classes', () => {
    render(
      <Overlay open onClose={() => {}} variant="sheet-bottom" aria-label="Sheet bottom">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('mt-auto')
    expect(dialog.className).toContain('rounded-t-xl')
  })

  it('applies sheet-left variant classes', () => {
    render(
      <Overlay open onClose={() => {}} variant="sheet-left" aria-label="Sheet left">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('h-dvh')
    expect(dialog.className).toContain('w-[min(86vw,340px)]')
  })

  it('applies fullscreen variant classes', () => {
    render(
      <Overlay open onClose={() => {}} variant="fullscreen" aria-label="Fullscreen">
        <p>Content</p>
      </Overlay>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('h-full')
    expect(dialog.className).toContain('w-full')
  })

  it('scroll lock is applied when open', () => {
    render(
      <Overlay open onClose={() => {}} aria-label="Scroll lock test">
        <p>Content</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('scroll lock is removed when closed', () => {
    const { rerender } = render(
      <Overlay open onClose={() => {}} aria-label="Scroll lock cleanup">
        <p>Content</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(
      <Overlay open={false} onClose={() => {}} aria-label="Scroll lock cleanup">
        <p>Content</p>
      </Overlay>,
    )
    expect(document.body.style.overflow).toBe('')
  })
})

