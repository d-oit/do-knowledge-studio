import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'


vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Home: Icon,
    FileText: Icon,
    Library: Icon,
    GitBranch: Icon,
    BrainCircuit: Icon,
    MessageSquare: Icon,
    FlaskConical: Icon,
    Grid3X3: Icon,
    Download: Icon,
    Sun: Icon,
    Moon: Icon,
    Search: Icon,
    PanelRight: Icon,
    PanelRightClose: Icon,
    Wifi: Icon,
  }
})

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: mockSetTheme }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('./shortcuts-dialog', () => ({
  ShortcutsTrigger: ({ className }: { className?: string }) => (
    <button data-testid="shortcuts-trigger" className={className}>Shortcuts</button>
  ),
}))

const mockSetTheme = vi.fn()
const mockSetView = vi.fn()
const mockSetCommandOpen = vi.fn()
const mockSetRightPanelOpen = vi.fn()

let currentView = 'home'
let rightPanelOpen = false

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: () => ({
    currentView,
    setView: mockSetView,
    setCommandOpen: mockSetCommandOpen,
    rightPanelOpen,
    setRightPanelOpen: mockSetRightPanelOpen,
  }),
}))

import { Sidebar, NAV_GROUPS } from './sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentView = 'home'
    rightPanelOpen = false
  })

  it('renders the Knowledge Studio brand', () => {
    render(<Sidebar />)
    expect(screen.getByText('Knowledge Studio')).toBeDefined()
  })

  it('renders version label', () => {
    render(<Sidebar />)
    expect(screen.getByText(/Local-first/)).toBeDefined()
  })

  it('renders the search trigger button', () => {
    render(<Sidebar />)
    expect(screen.getByLabelText('Open command palette')).toBeDefined()
  })

  it('opens command palette on search click', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Open command palette'))
    expect(mockSetCommandOpen).toHaveBeenCalledWith(true)
  })

  it('renders all navigation groups', () => {
    render(<Sidebar />)
    // Use getAllByText for labels that may appear multiple times (e.g., 'Lab' in badge)
    for (const group of NAV_GROUPS) {
      expect(screen.getAllByText(group.label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders all navigation items', () => {
    render(<Sidebar />)
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(screen.getByText(item.label)).toBeDefined()
      }
    }
  })

  it('highlights the active view', () => {
    currentView = 'editor'
    render(<Sidebar />)
    const editorBtn = screen.getByText('Editor').closest('button')!
    expect(editorBtn).toHaveAttribute('aria-current', 'page')
  })

  it('does not highlight inactive views', () => {
    currentView = 'home'
    render(<Sidebar />)
    const editorBtn = screen.getByText('Editor').closest('button')!
    expect(editorBtn).not.toHaveAttribute('aria-current')
  })

  it('navigates to view on click', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByText('Library').closest('button')!)
    expect(mockSetView).toHaveBeenCalledWith('library')
  })

  it('shows Lab badge for experimental items', () => {
    render(<Sidebar />)
    // AI Harness and TRIZ Matrix both have experimental: true — each gets a Lab badge
    const labBadges = screen.getAllByText('Lab')
    // At least 2 badges (one per experimental item) plus the group heading
    expect(labBadges.length).toBeGreaterThanOrEqual(2)
  })

  it('shows keyboard shortcut for non-experimental items', () => {
    render(<Sidebar />)
    // Home shortcut is G H — rendered inside a kbd
    const kbd = screen.getByText('G H')
    expect(kbd).toBeDefined()
    expect(kbd.tagName.toLowerCase()).toBe('kbd')
  })

  it('renders theme toggle button', () => {
    render(<Sidebar />)
    expect(screen.getByLabelText('Toggle theme')).toBeDefined()
  })

  it('theme toggle calls setTheme with dark when currently light', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Toggle theme'))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('shows Moon icon when theme is light', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dark')).toBeDefined()
  })

  it('shows right panel toggle button', () => {
    render(<Sidebar />)
    expect(screen.getByLabelText('Show panel')).toBeDefined()
  })

  it('toggles right panel on click', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Show panel'))
    expect(mockSetRightPanelOpen).toHaveBeenCalledWith(true)
  })

  it('shows Hide panel when right panel is open', () => {
    rightPanelOpen = true
    render(<Sidebar />)
    expect(screen.getByLabelText('Hide panel')).toBeDefined()
  })

  it('renders shortcuts trigger', () => {
    render(<Sidebar />)
    expect(screen.getByTestId('shortcuts-trigger')).toBeDefined()
  })

  it('NAV_GROUPS exports expected structure', () => {
    expect(NAV_GROUPS.length).toBeGreaterThanOrEqual(6)
    for (const group of NAV_GROUPS) {
      expect(group.label).toBeDefined()
      expect(group.items.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders navigation with accessible label', () => {
    render(<Sidebar />)
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeDefined()
  })
})
