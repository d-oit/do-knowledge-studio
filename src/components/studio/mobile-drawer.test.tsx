import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, onClose, 'aria-label': ariaLabel }: {
    children: ReactNode
    open: boolean
    onClose: () => void
    'aria-label'?: string
    variant?: string
    initialFocusRef?: React.RefObject<HTMLElement | null>
    className?: string
  }) =>
    open ? (
      // Backdrop div fires onClose; content div stops propagation so child clicks don't close
      <div data-testid="overlay-backdrop" onClick={onClose}>
        <div data-testid="overlay" role="dialog" aria-label={ariaLabel} onClick={(e) => { e.stopPropagation() }}>
          {children}
        </div>
      </div>
    ) : null,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { X: Icon, Search: Icon, Sun: Icon, Moon: Icon, FileText: Icon }
})

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: mockSetTheme }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/studio/types', () => ({
  ENTITY_TYPE_META: {
    concept: { label: 'Concept', dot: 'bg-blue-500' },
    reference: { label: 'Reference', dot: 'bg-green-500' },
  },
}))

vi.mock('@/lib/search/retrieval', () => ({
  search: vi.fn(() => []),
}))

vi.mock('./sidebar', () => ({
  NAV_GROUPS: [
    {
      label: 'Overview',
      items: [{ id: 'home', label: 'Home', icon: ({ className }: { className?: string }) => <span data-testid="icon" className={className} />, shortcut: 'G H' }],
    },
    {
      label: 'Capture',
      items: [{ id: 'editor', label: 'Editor', icon: ({ className }: { className?: string }) => <span data-testid="icon" className={className} />, shortcut: 'G E' }],
    },
    {
      label: 'Lab',
      items: [{ id: 'ai', label: 'AI Harness', icon: ({ className }: { className?: string }) => <span data-testid="icon" className={className} />, shortcut: 'G A', experimental: true }],
    },
  ],
}))

const mockSetTheme = vi.fn()
const mockSetMobileDrawerOpen = vi.fn()
const mockSetMobilePanelView = vi.fn()
const mockSetView = vi.fn()
const mockSetSearchQuery = vi.fn()
const mockStartEdit = vi.fn()

let mobileDrawerOpen = false
let mobilePanelView: 'nav' | 'search' = 'nav'
let currentView = 'home'
let searchQuery = ''

const mockEntities = [
  { id: 'ent-1', name: 'Test Entity', type: 'concept', description: 'A test', content: '', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), links: [] },
]
const mockClaims: unknown[] = []

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        mobileDrawerOpen,
        setMobileDrawerOpen: mockSetMobileDrawerOpen,
        mobilePanelView,
        setMobilePanelView: mockSetMobilePanelView,
        currentView,
        setView: mockSetView,
        searchQuery,
        setSearchQuery: mockSetSearchQuery,
        entities: mockEntities,
        claims: mockClaims,
        startEdit: mockStartEdit,
      }),
    { getState: () => ({}) },
  ),
  useFilteredEntities: () => mockEntities,
}))

// Mock window.matchMedia (not available in JSDOM)
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

import { MobileDrawer } from './mobile-drawer'

describe('MobileDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mobileDrawerOpen = false
    mobilePanelView = 'nav'
    currentView = 'home'
    searchQuery = ''
  })

  it('renders nothing when closed', () => {
    mobileDrawerOpen = false
    const { container } = render(<MobileDrawer />)
    expect(container.querySelector('[data-testid="overlay"]')).toBeNull()
  })

  it('renders the drawer when open', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByTestId('overlay')).toBeDefined()
  })

  it('has accessible dialog label', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByRole('dialog', { name: 'Navigation and search' })).toBeDefined()
  })

  it('renders the Knowledge Studio brand', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByText('Knowledge Studio')).toBeDefined()
  })

  it('renders version label', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByText(/Local-first/)).toBeDefined()
  })

  it('renders the close button', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByLabelText('Close drawer')).toBeDefined()
  })

  it('closes drawer on close button click', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    fireEvent.click(screen.getByLabelText('Close drawer'))
    expect(mockSetMobileDrawerOpen).toHaveBeenCalledWith(false)
  })

  it('renders tab switcher with Navigate and Search tabs', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByText('Navigate')).toBeDefined()
    expect(screen.getByText('Search')).toBeDefined()
  })

  it('tab switcher has tablist role', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByRole('tablist', { name: 'Drawer view' })).toBeDefined()
  })

  it('Navigate tab is selected by default', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'nav'
    render(<MobileDrawer />)
    const navTab = screen.getByText('Navigate')
    expect(navTab).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to Search tab on click', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'nav'
    render(<MobileDrawer />)
    fireEvent.click(screen.getByText('Search'))
    expect(mockSetMobilePanelView).toHaveBeenCalledWith('search')
  })

  it('renders nav groups in Navigate tab', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'nav'
    render(<MobileDrawer />)
    expect(screen.getByText('Overview')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('Editor')).toBeDefined()
  })

  it('renders experimental badge in nav tab', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'nav'
    render(<MobileDrawer />)
    expect(screen.getByText('AI Harness')).toBeDefined()
    expect(screen.getAllByText('Lab').length).toBeGreaterThanOrEqual(1)
  })

  it('renders navigation with accessible label', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'nav'
    render(<MobileDrawer />)
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeDefined()
  })

  it('renders search input in Search tab', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'search'
    render(<MobileDrawer />)
    expect(screen.getByPlaceholderText('Search knowledge base…')).toBeDefined()
  })

  it('renders keyword/ranked toggle in Search tab', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'search'
    render(<MobileDrawer />)
    expect(screen.getByText('Keyword')).toBeDefined()
    expect(screen.getByText('Ranked')).toBeDefined()
  })

  it('shows Offline ready badge in search tab footer', () => {
    mobileDrawerOpen = true
    mobilePanelView = 'search'
    render(<MobileDrawer />)
    expect(screen.getByText(/Offline ready/)).toBeDefined()
  })

  it('shows entity count in footer', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByText(/1 entities/)).toBeDefined()
  })

  it('shows theme toggle in footer', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByLabelText('Switch to dark theme')).toBeDefined()
  })

  it('theme toggle switches to dark', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    fireEvent.click(screen.getByLabelText('Switch to dark theme'))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('shows local search indicator in footer', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    expect(screen.getByText(/Local search/)).toBeDefined()
  })

  it('closes drawer on backdrop click', () => {
    mobileDrawerOpen = true
    render(<MobileDrawer />)
    fireEvent.click(screen.getByTestId('overlay-backdrop'))
    expect(mockSetMobileDrawerOpen).toHaveBeenCalledWith(false)
  })
})
