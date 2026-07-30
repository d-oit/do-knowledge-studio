import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { Menu: Icon, Plus: Icon, Search: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

const mockStartNew = vi.fn()
const mockSetCommandOpen = vi.fn()
const mockSetSearchQuery = vi.fn()
const mockSetMobileDrawerOpen = vi.fn()
const mockSetMobilePanelView = vi.fn()

let currentView = 'home'
let searchQuery = ''

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: () => ({
    currentView,
    startNew: mockStartNew,
    setCommandOpen: mockSetCommandOpen,
    searchQuery,
    setSearchQuery: mockSetSearchQuery,
    setMobileDrawerOpen: mockSetMobileDrawerOpen,
    setMobilePanelView: mockSetMobilePanelView,
  }),
}))

import { Topbar } from './topbar'

describe('Topbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentView = 'home'
    searchQuery = ''
  })

  it('renders the view title', () => {
    render(<Topbar />)
    expect(screen.getByRole('heading', { name: 'Studio' })).toBeDefined()
  })

  it('renders the subtitle', () => {
    render(<Topbar />)
    expect(screen.getByText('Your knowledge base at a glance')).toBeDefined()
  })

  it('shows correct title for different views', () => {
    currentView = 'editor'
    const { unmount } = render(<Topbar />)
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeDefined()
    unmount()

    currentView = 'library'
    render(<Topbar />)
    expect(screen.getByRole('heading', { name: 'Library' })).toBeDefined()
  })

  it('shows correct title for all view IDs', () => {
    const views = [
      { id: 'home', title: 'Studio' },
      { id: 'graph', title: 'Graph' },
      { id: 'mindmap', title: 'Mind Map' },
      { id: 'chat', title: 'Chat' },
      { id: 'ai', title: 'AI Harness' },
      { id: 'triz', title: 'TRIZ Matrix' },
      { id: 'export', title: 'Export' },
      { id: 'sync', title: 'Sync' },
    ]
    for (const view of views) {
      currentView = view.id
      const { unmount } = render(<Topbar />)
      expect(screen.getByRole('heading', { name: view.title })).toBeDefined()
      unmount()
    }
  })

  it('shows New entity button', () => {
    render(<Topbar />)
    expect(screen.getByLabelText('New entity')).toBeDefined()
  })

  it('calls startNew on New entity click', () => {
    render(<Topbar />)
    fireEvent.click(screen.getByLabelText('New entity'))
    expect(mockStartNew).toHaveBeenCalled()
  })

  it('shows search input with Search placeholder for non-library views', () => {
    currentView = 'home'
    render(<Topbar />)
    expect(screen.getByPlaceholderText('Search…')).toBeDefined()
  })

  it('shows Filter library placeholder for library view', () => {
    currentView = 'library'
    render(<Topbar />)
    expect(screen.getByPlaceholderText('Filter library…')).toBeDefined()
  })

  it('search input updates store on change', () => {
    render(<Topbar />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'test' } })
    expect(mockSetSearchQuery).toHaveBeenCalledWith('test')
  })

  it('opens command palette on ⌘K in search input', () => {
    render(<Topbar />)
    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'k', metaKey: true })
    expect(mockSetCommandOpen).toHaveBeenCalledWith(true)
  })

  it('opens command palette on Ctrl+K in search input', () => {
    render(<Topbar />)
    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'k', ctrlKey: true })
    expect(mockSetCommandOpen).toHaveBeenCalledWith(true)
  })

  it('renders command palette button', () => {
    render(<Topbar />)
    expect(screen.getByLabelText('Open command palette')).toBeDefined()
  })

  it('opens command palette on button click', () => {
    render(<Topbar />)
    fireEvent.click(screen.getByLabelText('Open command palette'))
    expect(mockSetCommandOpen).toHaveBeenCalledWith(true)
  })

  it('renders mobile menu button', () => {
    render(<Topbar />)
    expect(screen.getByLabelText('Open menu')).toBeDefined()
  })

  it('opens mobile drawer on menu click', () => {
    render(<Topbar />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(mockSetMobileDrawerOpen).toHaveBeenCalledWith(true)
  })

  it('renders mobile search button', () => {
    render(<Topbar />)
    expect(screen.getByLabelText('Search knowledge base')).toBeDefined()
  })

  it('opens mobile drawer on search tab on search click', () => {
    render(<Topbar />)
    fireEvent.click(screen.getByLabelText('Search knowledge base'))
    expect(mockSetMobilePanelView).toHaveBeenCalledWith('search')
    expect(mockSetMobileDrawerOpen).toHaveBeenCalledWith(true)
  })

  it('renders Offline ready badge', () => {
    render(<Topbar />)
    expect(screen.getByText('Offline ready')).toBeDefined()
  })

  it('uses correct aria-label for library filter', () => {
    currentView = 'library'
    render(<Topbar />)
    expect(screen.getByLabelText('Filter library')).toBeDefined()
  })

  it('uses correct aria-label for search', () => {
    currentView = 'home'
    render(<Topbar />)
    expect(screen.getByLabelText('Search')).toBeDefined()
  })
})
