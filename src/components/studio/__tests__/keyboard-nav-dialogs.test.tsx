import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// JSDOM polyfills
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => {
  const factory = (tag: string) =>
    function MockMotion({
      children,
      initial: _i,
      animate: _a,
      transition: _t,
      ...props
    }: {
      children?: ReactNode
      [key: string]: unknown
    }) {
      const Tag = tag as keyof JSX.IntrinsicElements
      return <Tag {...(props as Record<string, unknown>)}>{children}</Tag>
    }
  return {
    motion: { div: factory('div'), section: factory('section') },
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
  }
})

type CmdkMockProps = {
  children?: ReactNode
  label?: string
  heading?: string
  onSelect?: () => void
  value?: string
  onValueChange?: (value: string) => void
  [key: string]: unknown
}

vi.mock('cmdk', () => ({
  Command: Object.assign(
    ({ children, label, shouldFilter: _sf, value: _v, onValueChange: _ovc, filter: _f, loop: _l, defaultValue: _d, ...props }: CmdkMockProps) => (
      <div aria-label={label} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    ),
    {
      Input: ({ children: _c, onValueChange, value, ...props }: CmdkMockProps) => (
        <input
          value={value ?? ''}
          onChange={(e) => { onValueChange?.(e.target.value) }}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      ),
      List: ({ children, ...props }: CmdkMockProps) => (
        <div role="listbox" {...(props as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      ),
      Empty: ({ children, ...props }: CmdkMockProps) => (
        <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
      Group: ({ children, heading, ...props }: CmdkMockProps) => (
        <div aria-label={heading} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      ),
      Item: ({
        children,
        onSelect,
        value: _v,
        ...props
      }: CmdkMockProps & { onSelect?: () => void }) => (
        <div
          role="option"
          aria-selected="false"
          onClick={onSelect}
          onKeyDown={(e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && onSelect) onSelect()
          }}
          tabIndex={0}
          {...(props as React.HTMLAttributes<HTMLDivElement>)}
        >
          {children}
        </div>
      ),
    },
  ),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/sync/bridge', () => ({
  startBidirectionalSync: () => vi.fn(),
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({
  useReducedMotion: () => true,
}))

vi.mock('@/lib/search/retrieval', () => ({
  search: () => [],
}))

// ---------------------------------------------------------------------------
// Store mock — mutable shared state, handles both selector and non-selector calls
// ---------------------------------------------------------------------------

const storeFns = {
  setCommandOpen: vi.fn(),
  setView: vi.fn(),
  startNew: vi.fn(),
  setMobileDrawerOpen: vi.fn(),
  setMobilePanelView: vi.fn(),
  setSearchQuery: vi.fn(),
  setRightPanelOpen: vi.fn(),
  startEdit: vi.fn(),
  finishEditing: vi.fn(),
}

const storeState: Record<string, unknown> = {
  currentView: 'home',
  commandOpen: false,
  entities: [] as Array<{ id: string; name: string; type: string; description: string }>,
  claims: [],
  searchQuery: '',
  editingEntityId: null,
  rightPanelOpen: true,
  mobileDrawerOpen: false,
  mobilePanelView: 'nav',
  typeFilter: 'all',
  sortBy: 'updated',
  sortDir: 'desc',
  ...storeFns,
}

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    if (typeof selector === 'function') return selector(storeState)
    return storeState
  },
  useFilteredEntities: () => [],
  useStats: () => ({
    total: 0,
    claims: 0,
    verified: 0,
    byType: {},
    recent: [],
  }),
}))

// Import components AFTER mocks
import { Overlay } from '@/components/studio/ui/shared-primitives'
import { CommandPalette } from '@/components/studio/command-palette'

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  storeState.commandOpen = false
  storeState.mobileDrawerOpen = false
  storeState.mobilePanelView = 'nav'
  storeState.currentView = 'home'
  storeState.entities = []
  storeState.searchQuery = ''
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// 1. Overlay — Escape / Tab trapped navigation
// ---------------------------------------------------------------------------

describe('Overlay keyboard navigation', () => {
  describe('Escape key', () => {
    it('closes overlay when Escape is pressed', () => {
      const onClose = vi.fn()
      render(
        <Overlay open onClose={onClose} aria-label="Test dialog">
          <p>Content</p>
        </Overlay>,
      )
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('does not close when closeOnEscape is false', () => {
      const onClose = vi.fn()
      render(
        <Overlay open onClose={onClose} closeOnEscape={false} aria-label="No escape">
          <p>Content</p>
        </Overlay>,
      )
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
    })

    it('stops propagation so parent handlers do not fire', () => {
      const onClose = vi.fn()
      const parentHandler = vi.fn()
      render(
        <div onKeyDown={parentHandler}>
          <Overlay open onClose={onClose} aria-label="Propagation test">
            <p>Content</p>
          </Overlay>
        </div>,
      )
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(onClose).toHaveBeenCalledOnce()
      expect(parentHandler).not.toHaveBeenCalled()
    })
  })

  describe('Tab / Shift+Tab focus trapping', () => {
    it('wraps Tab from last focusable back to first', () => {
      render(
        <Overlay open onClose={() => undefined} aria-label="Focus trap test">
          <button data-testid="first">First</button>
          <button data-testid="last">Last</button>
        </Overlay>,
      )
      const last = screen.getByTestId('last')
      const first = screen.getByTestId('first')
      last.focus()
      fireEvent.keyDown(last, { key: 'Tab' })
      expect(document.activeElement).toBe(first)
    })

    it('wraps Shift+Tab from first focusable back to last', () => {
      render(
        <Overlay open onClose={() => undefined} aria-label="Focus trap shift test">
          <button data-testid="first">First</button>
          <button data-testid="last">Last</button>
        </Overlay>,
      )
      const first = screen.getByTestId('first')
      const last = screen.getByTestId('last')
      first.focus()
      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(last)
    })

    it('focuses first interactive element on open', () => {
      render(
        <Overlay open onClose={() => undefined} aria-label="Autofocus test">
          <button data-testid="first">First</button>
          <button data-testid="last">Last</button>
        </Overlay>,
      )
      const first = screen.getByTestId('first')
      expect(document.activeElement).toBe(first)
    })

    it('does not trap when trapFocus is disabled', () => {
      render(
        <Overlay open onClose={() => undefined} trapFocus={false} aria-label="No trap">
          <button data-testid="first">First</button>
          <button data-testid="last">Last</button>
        </Overlay>,
      )
      const last = screen.getByTestId('last')
      last.focus()
      fireEvent.keyDown(last, { key: 'Tab' })
      // Without trap, Tab does nothing in JSDOM — focus stays on last
      expect(document.activeElement).toBe(last)
    })
  })
})

// ---------------------------------------------------------------------------
// 2. CommandPalette — Escape / Enter / Space / Search input
// ---------------------------------------------------------------------------

describe('CommandPalette keyboard navigation', () => {
  const onEntitySelect = vi.fn()

  beforeEach(() => {
    onEntitySelect.mockClear()
    storeState.commandOpen = true
  })

  const renderOpen = () =>
    render(<CommandPalette onEntitySelect={onEntitySelect} />)

  describe('Escape key', () => {
    it('closes the palette via Escape on the dialog', () => {
      renderOpen()
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(storeFns.setCommandOpen).toHaveBeenCalledWith(false)
    })
  })

  describe('Enter / Space on command items', () => {
    it('triggers onSelect when a nav item is clicked', () => {
      renderOpen()
      fireEvent.click(screen.getByText('Home'))
      expect(storeFns.setView).toHaveBeenCalledWith('home')
    })

    it('triggers onSelect when a nav item receives Enter', () => {
      renderOpen()
      const homeItem = screen.getByText('Home').closest('[role="option"]')!
      fireEvent.keyDown(homeItem, { key: 'Enter' })
      expect(storeFns.setView).toHaveBeenCalledWith('home')
    })

    it('triggers onSelect when a nav item receives Space', () => {
      renderOpen()
      const editorItem = screen.getByText('Editor').closest('[role="option"]')!
      fireEvent.keyDown(editorItem, { key: ' ' })
      expect(storeFns.setView).toHaveBeenCalledWith('editor')
    })

    it('"Create new entity" item calls startNew', () => {
      renderOpen()
      const createItem = screen
        .getByText('Create new entity')
        .closest('[role="option"]')!
      fireEvent.click(createItem)
      expect(storeFns.startNew).toHaveBeenCalledOnce()
    })

    it('entity library items call onEntitySelect', () => {
      storeState.entities = [
        { id: 'e1', name: 'Test Entity', type: 'note', description: 'desc' },
      ]
      renderOpen()
      const entityItem = screen.getByText('Test Entity').closest('[role="option"]')!
      fireEvent.click(entityItem)
      expect(onEntitySelect).toHaveBeenCalledWith('e1')
    })
  })

  describe('Search input', () => {
    it('renders the search input', () => {
      renderOpen()
      const input = screen.getByPlaceholderText('Search commands and entities\u2026')
      expect(input).toBeDefined()
    })

    it('is focusable and has the correct type', () => {
      renderOpen()
      const input = screen.getByPlaceholderText('Search commands and entities\u2026')
      expect((input as HTMLInputElement).type).toBe('text')
    })
  })

  describe('Keyboard shortcut to open', () => {
    it('renders the ESC hint badge', () => {
      renderOpen()
      expect(screen.getByText('ESC')).toBeDefined()
    })

    it('renders navigation groups with correct items', () => {
      renderOpen()
      expect(screen.getByText('Home')).toBeDefined()
      expect(screen.getByText('Library')).toBeDefined()
      expect(screen.getByText('Graph')).toBeDefined()
    })

    it('shows all Navigate group items', () => {
      renderOpen()
      const navItems = [
        'Home',
        'Editor',
        'Library',
        'Graph',
        'Mind Map',
        'Chat',
        'AI Harness',
        'TRIZ Matrix',
        'Export',
      ]
      for (const label of navItems) {
        expect(screen.getByText(label)).toBeDefined()
      }
    })
  })
})


describe('ShortcutsDialog keyboard navigation', () => {
  let ShortcutsDialog: React.ComponentType & {
    ShortcutsTrigger: React.ComponentType<{ className?: string }>
  }
  let ShortcutsTrigger: React.ComponentType<{ className?: string }>

  beforeAll(async () => {
    vi.resetModules()
    const mod = await import('@/components/studio/shortcuts-dialog')
    ShortcutsDialog = mod.ShortcutsDialog
    ShortcutsTrigger = mod.ShortcutsTrigger
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ShortcutsTrigger renders a button with aria-label', () => {
    render(<ShortcutsTrigger />)
    const btn = screen.getByRole('button', { name: 'Show keyboard shortcuts' })
    expect(btn).toBeDefined()
  })

  it('ShortcutsTrigger opens dialog on click', () => {
    render(
      <>
        <ShortcutsTrigger />
        <ShortcutsDialog />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }))
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(dialog).toBeDefined()
  })

  it('close button is focused when dialog opens', () => {
    render(
      <>
        <ShortcutsTrigger />
        <ShortcutsDialog />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }))
    const closeBtn = screen.getByRole('button', { name: 'Close shortcuts dialog' })
    expect(document.activeElement).toBe(closeBtn)
  })

  it('filter input renders and is accessible', () => {
    render(
      <>
        <ShortcutsTrigger />
        <ShortcutsDialog />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }))
    const filterInput = screen.getByRole('textbox', { name: 'Filter shortcuts' })
    expect(filterInput).toBeDefined()
  })

  it('dialog has proper aria-modal and role', () => {
    render(
      <>
        <ShortcutsTrigger />
        <ShortcutsDialog />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }))
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })
})

