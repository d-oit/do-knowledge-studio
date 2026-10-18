import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'

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

const { mockSetView, mockSetCommandOpen, mockSetMobileDrawerOpen } = vi.hoisted(() => ({
  mockSetView: vi.fn(),
  mockSetCommandOpen: vi.fn(),
  mockSetMobileDrawerOpen: vi.fn(),
}))

// The component selects individual slices (`useStudioStore((s) => s.commandOpen)`), so this
// mock has to apply the selector. Returning the whole state object for every call would make
// each selected value the state object itself, which is always truthy — leaving guards such
// as `!commandOpen` impossible to exercise.
//
// `vi.hoisted` creates the action spies before the store mock factory runs, so
// static imports can safely access the mock state.
vi.mock('@/lib/studio/store', () => {
  let state: Record<string, unknown> = {
    currentView: 'home',
    setView: mockSetView,
    commandOpen: false,
    mobileDrawerOpen: false,
    setCommandOpen: mockSetCommandOpen,
    setMobileDrawerOpen: mockSetMobileDrawerOpen,
    shortcutsOpen: false,
  }
  const listeners = new Set<() => void>()
  const setShortcutsOpen = (open: boolean) => {
    state = { ...state, shortcutsOpen: open }
    listeners.forEach((listener) => listener())
  }
  state = { ...state, setShortcutsOpen }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const useStudioStore = (selector?: (s: Record<string, unknown>) => unknown) => {
    const currentState = useSyncExternalStore(subscribe, () => state, () => state)
    return typeof selector === 'function' ? selector(currentState) : currentState
  }
  return {
    useStudioStore: Object.assign(useStudioStore, {
      getState: () => state,
    }),
    setShortcutsOpen,
  }
})
import { useStudioStore } from '@/lib/studio/store'

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
    expect(filterInput.type).toBe('search')
    expect(filterInput.className).toContain('min-h-touch')
    expect(filterInput.value).toBe('')
    expect(filterInput.className).toContain('pr-3')
    expect(filterInput.className).not.toContain('pr-13')
    expect(screen.queryByLabelText('Clear filter search')).toBeNull()

    // Type filter text
    fireEvent.change(filterInput, { target: { value: 'Bold' } })
    expect(filterInput.value).toBe('Bold')
    expect(filterInput.className).toContain('pr-13')
    expect(screen.getByRole('status').textContent).toBe('1 shortcut found')

    // Clear button should now be visible
    const clearBtn = screen.getByLabelText('Clear filter search')
    expect(clearBtn).toBeDefined()
    expect(clearBtn.getAttribute('title')).toBe('Clear filter search')

    // Click clear button (prevent default / click handlers on buttons contained inside mocked Overlay)
    fireEvent.click(clearBtn)
    expect(filterInput.value).toBe('')
    expect(filterInput.className).toContain('pr-3')
    expect(filterInput.className).not.toContain('pr-13')
    expect(screen.queryByLabelText('Clear filter search')).toBeNull()

    // Clearing should restore focus to the filter input.
    expect(document.activeElement).toBe(filterInput)
  })

  it('supports rapid sequence: type filter -> click clear -> press Escape to close cleanly', () => {
    render(
      <>
        <ShortcutsTrigger />
        <ShortcutsDialog />
      </>,
    )

    // Open dialog
    fireEvent.click(screen.getByLabelText('Show keyboard shortcuts'))
    const filterInput = screen.getByLabelText('Filter shortcuts') as HTMLInputElement

    // Rapid type -> clear -> Escape
    fireEvent.change(filterInput, { target: { value: 'Navigate' } })
    const clearBtn = screen.getByLabelText('Clear filter search')
    fireEvent.click(clearBtn)
    expect(filterInput.value).toBe('')

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByTestId('overlay')).toBeNull()
  })
})

describe('ShortcutsTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStudioStore.getState().setShortcutsOpen(false)
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

  it('opens the shared shortcuts dialog when clicked', () => {
    render(<ShortcutsTrigger />)
    fireEvent.click(screen.getByLabelText('Show keyboard shortcuts'))

    expect(useStudioStore.getState().shortcutsOpen).toBe(true)
  })

  it('renders without className prop', () => {
    const { container } = render(<ShortcutsTrigger />)
    expect(container.firstElementChild).toBeDefined()
  })
})
