import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { X: Icon, Keyboard: Icon, Search: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, 'aria-label': ariaLabel }: {
    children: ReactNode
    open: boolean
    onClose: () => void
    'aria-label'?: string
    variant?: string
    closeOnEscape?: boolean
    initialFocusRef?: React.RefObject<HTMLElement | null>
    className?: string
  }) =>
    open ? (
      <div data-testid="overlay" role="dialog" aria-label={ariaLabel}>
        {children}
      </div>
    ) : null,
}))

const mockSetView = vi.fn()
const mockSetCommandOpen = vi.fn()
const mockSetMobileDrawerOpen = vi.fn()

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: Object.assign(
    () => ({
      currentView: 'home',
      setView: mockSetView,
      commandOpen: false,
      mobileDrawerOpen: false,
      setCommandOpen: mockSetCommandOpen,
      setMobileDrawerOpen: mockSetMobileDrawerOpen,
    }),
    { getState: () => ({ currentView: 'home', setView: mockSetView }) },
  ),
}))

import { ShortcutsDialog, ShortcutsTrigger } from './shortcuts-dialog'

describe('ShortcutsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders filter search clear button when text is entered and clears input on click', () => {
    render(
      <>
        <ShortcutsTrigger />
        <ShortcutsDialog />
      </>,
    )

    // Open the dialog
    fireEvent.click(screen.getByLabelText('Show keyboard shortcuts'))

    const filterInput = screen.getByLabelText('Filter shortcuts') as HTMLInputElement
    expect(filterInput.value).toBe('')
    expect(screen.queryByLabelText('Clear filter search')).toBeNull()

    // Type filter text
    fireEvent.change(filterInput, { target: { value: 'Bold' } })
    expect(filterInput.value).toBe('Bold')

    // Clear button should now be visible
    const clearBtn = screen.getByLabelText('Clear filter search')
    expect(clearBtn).toBeDefined()
    expect(clearBtn.getAttribute('title')).toBe('Clear filter search')

    // Click clear button (prevent default / click handlers on buttons contained inside mocked Overlay)
    fireEvent.click(clearBtn)
    expect(filterInput.value).toBe('')
    expect(screen.queryByLabelText('Clear filter search')).toBeNull()
  })
})

describe('ShortcutsTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Shortcuts button', () => {
    render(<ShortcutsTrigger />)
    expect(screen.getByLabelText('Show keyboard shortcuts')).toBeDefined()
  })

  it('renders Shortcuts text', () => {
    render(<ShortcutsTrigger />)
    expect(screen.getByText('Shortcuts')).toBeDefined()
  })

  it('renders keyboard icon', () => {
    render(<ShortcutsTrigger />)
    expect(screen.getByTestId('icon')).toBeDefined()
  })

  it('has correct title attribute', () => {
    render(<ShortcutsTrigger />)
    expect(screen.getByTitle('Keyboard shortcuts (?)')).toBeDefined()
  })

  it('applies custom className', () => {
    const { container } = render(<ShortcutsTrigger className="custom-class" />)
    expect(container.firstElementChild?.className).toContain('custom-class')
  })

  it('is a button element', () => {
    render(<ShortcutsTrigger />)
    const btn = screen.getByLabelText('Show keyboard shortcuts')
    expect(btn.tagName.toLowerCase()).toBe('button')
  })

  it('has correct type attribute', () => {
    render(<ShortcutsTrigger />)
    const btn = screen.getByLabelText('Show keyboard shortcuts')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('clicking does not throw', () => {
    render(<ShortcutsTrigger />)
    // The dialog state is module-scoped, so we verify the click handler fires cleanly
    expect(() => {
      fireEvent.click(screen.getByLabelText('Show keyboard shortcuts'))
    }).not.toThrow()
  })

  it('renders without className prop', () => {
    const { container } = render(<ShortcutsTrigger />)
    expect(container.firstElementChild).toBeDefined()
  })
})
