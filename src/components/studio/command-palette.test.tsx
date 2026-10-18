import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { InputHTMLAttributes, ReactNode } from 'react'

// cmdk mock — must use vi.hoisted so the mock is available when vi.mock is hoisted.
// Command is the default export, used as `Command as CommandPrimitive`.
const { MockCommand } = vi.hoisted(() => {
  const Root = ({ children, label }: { children?: ReactNode; label?: string }) => (
    <div data-testid="cmdk-root" aria-label={label}>{children}</div>
  )
  Root.Input = ({
    placeholder,
    value,
    onValueChange,
    ...props
  }: InputHTMLAttributes<HTMLInputElement> & {
    onValueChange?: (value: string) => void
  }) => (
    <input
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(event) => { onValueChange?.(event.target.value) }}
      {...props}
    />
  )
  Root.List = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  Root.Empty = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  Root.Group = ({ heading, children }: { heading?: string; children?: ReactNode }) => (
    <div>
      {heading && <div role="presentation">{heading}</div>}
      {children}
    </div>
  )
  Root.Item = ({ children, onSelect, ...props }: { children?: ReactNode; onSelect?: () => void; [key: string]: unknown }) => (
    // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- test mock
    <div role="option" onClick={onSelect} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
      {children}
    </div>
  )
  return { MockCommand: Root }
})

vi.mock('cmdk', () => ({
  Command: MockCommand,
}))

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
    FileJson: Icon,
    SunMoon: Icon,
    Search: Icon,
    CornerDownLeft: Icon,
  }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/studio/ui/shared-primitives', () => ({
  Overlay: ({ children, open, onClose, 'aria-label': ariaLabel }: {
    children: ReactNode
    open: boolean
    onClose: () => void
    'aria-label'?: string
    variant?: string
    className?: string
  }) =>
    open ? (
      <div data-testid="overlay" aria-label={ariaLabel} onClick={onClose}>
        {children}
      </div>
    ) : null,
}))

const mockSetCommandOpen = vi.fn()
const mockSetView = vi.fn()
const mockStartNew = vi.fn()
const mockSetTheme = vi.fn()
const mockExportLibraryJson = vi.fn()

let commandOpen = false
/** Theme choice the hydration-safe hook reports; toggled per test. */
let mockTheme: string | undefined = 'system'
const mockEntities = [
  {
    id: 'ent-1',
    name: 'Test Entity',
    type: 'concept' as const,
    description: 'A test concept',
    content: '# Hello',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
  {
    id: 'ent-2',
    name: 'TRIZ Methodology',
    type: 'reference' as const,
    description: 'Theory of Inventive Problem Solving',
    content: '',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    links: [],
  },
]

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      commandOpen,
      setCommandOpen: mockSetCommandOpen,
      setView: mockSetView,
      startNew: mockStartNew,
      entities: mockEntities,
      claims: [],
      graph: undefined,
      mindMap: undefined,
      links: undefined,
      tags: undefined,
    }),
}))

vi.mock('@/components/studio/theme-provider', () => ({
  useHydrationSafeTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}))

// The palette delegates JSON creation to the shared export helper.
vi.mock('@/components/studio/views/export-library-json', () => ({
  exportLibraryJson: (payload: unknown) => { mockExportLibraryJson(payload) },
}))

vi.mock('@/lib/studio/types', () => ({
  ENTITY_TYPE_META: {
    concept: { label: 'Concept' },
    reference: { label: 'Reference' },
    person: { label: 'Person' },
  },
}))

import { CommandPalette } from './command-palette'

const defaultProps = {
  onEntitySelect: vi.fn(),
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    commandOpen = false
    mockTheme = 'system'
  })

  it('renders nothing when command palette is closed', () => {
    commandOpen = false
    const { container } = render(<CommandPalette {...defaultProps} />)
    expect(container.querySelector('[data-testid="overlay"]')).toBeNull()
  })

  it('renders the command palette when open', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByTestId('overlay')).toBeDefined()
  })

  it('shows search input with placeholder', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search commands and entities…')).toBeDefined()
  })

  it('renders navigation items', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    // 'Library' appears as both a group heading and an item label
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('Editor')).toBeDefined()
    expect(screen.getAllByText('Library').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Graph')).toBeDefined()
    expect(screen.getByText('Mind Map')).toBeDefined()
    expect(screen.getByText('Chat')).toBeDefined()
    expect(screen.getByText('AI Harness')).toBeDefined()
    expect(screen.getByText('TRIZ Matrix')).toBeDefined()
    expect(screen.getByText('Export')).toBeDefined()
  })

  it('renders create new entity item', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByText('Create new entity')).toBeDefined()
  })

  it('renders entity search results', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByText('Test Entity')).toBeDefined()
    expect(screen.getByText('TRIZ Methodology')).toBeDefined()
  })

  it('shows entity type hints', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByText('Concept')).toBeDefined()
    expect(screen.getByText('Reference')).toBeDefined()
  })

  it('shows result count', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    // 9 nav + 1 create + 2 actions + 2 entities = 14
    expect(screen.getByText('14 results')).toBeDefined()
  })

  it('shows keyboard shortcut hints', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByText('ESC')).toBeDefined()
    expect(screen.getByText(/navigate · .* select · esc close/)).toBeDefined()
  })

  it('shows No matches empty state', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByText('No matches.')).toBeDefined()
  })

  it('renders groups (Navigate, Create, Actions, Library)', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    // Group headings are rendered in presentation divs; 'Library' and 'Navigate'
    // also appear as item labels, so use getAllByText
    expect(screen.getAllByText('Navigate').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Create').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Actions').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Library').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onEntitySelect when entity is selected', () => {
    commandOpen = true
    const onEntitySelect = vi.fn()
    render(<CommandPalette {...defaultProps} onEntitySelect={onEntitySelect} />)
    const entityOption = screen.getByText('Test Entity').closest('[role="option"]')!
    fireEvent.click(entityOption)
    expect(onEntitySelect).toHaveBeenCalledWith('ent-1')
  })

  it('closes after entity selection', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    const entityOption = screen.getByText('Test Entity').closest('[role="option"]')!
    fireEvent.click(entityOption)
    expect(mockSetCommandOpen).toHaveBeenCalledWith(false)
  })

  it('closes on overlay click', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    fireEvent.click(screen.getByTestId('overlay'))
    expect(mockSetCommandOpen).toHaveBeenCalledWith(false)
  })

  it('has accessible label on command root', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByTestId('cmdk-root')).toHaveAttribute('aria-label', 'Command palette')
  })

  it('search input exists when open', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    const input = screen.getByPlaceholderText('Search commands and entities…')
    expect(input).toBeDefined()
  })

  it('renders all navigation group items with icons', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    const icons = screen.getAllByTestId('icon')
    // Each item has an icon: 9 nav + 1 create + 2 actions + 2 entities + Search = 15
    expect(icons.length).toBeGreaterThanOrEqual(12)
  })

  it('renders the create, export, and theme commands', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByText('Create new entity')).toBeDefined()
    expect(screen.getByText('Export library as JSON')).toBeDefined()
    expect(screen.getByText('Toggle theme')).toBeDefined()
  })

  it('keeps group order: Navigate, Create, Actions, then Library results', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    const headings = screen.getAllByRole('presentation').map((el) => el.textContent)
    expect(headings).toEqual(['Navigate', 'Create', 'Actions', 'Library'])
  })

  it('filters commands by label and hint, keeping the create command', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('Search commands and entities…'), {
      target: { value: 'graph' },
    })

    // cmdk's own filter is off, so this predicate is the palette's only search.
    expect(screen.getByText('Graph')).toBeDefined()
    expect(screen.getByText('Create new entity')).toBeDefined()
    expect(screen.queryByText('Toggle theme')).toBeNull()
    expect(screen.queryByText('Export library as JSON')).toBeNull()
    expect(screen.queryByText('Home')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Search commands and entities…'), {
      target: { value: '' },
    })
    expect(screen.getByText('Toggle theme')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
  })

  it('passes the trimmed query to startNew when creating', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('Search commands and entities…'), {
      target: { value: '  Quantum notes  ' },
    })
    fireEvent.click(screen.getByText('Create new entity').closest('[role="option"]')!)
    expect(mockStartNew).toHaveBeenCalledWith('Quantum notes')
    expect(mockSetCommandOpen).toHaveBeenCalledWith(false)
  })

  it('passes a blank name to startNew when no query was typed', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    fireEvent.click(screen.getByText('Create new entity').closest('[role="option"]')!)
    expect(mockStartNew).toHaveBeenCalledWith('')
  })

  it('runs the export view JSON handler with the library payload', () => {
    commandOpen = true
    render(<CommandPalette {...defaultProps} />)
    fireEvent.click(screen.getByText('Export library as JSON').closest('[role="option"]')!)
    expect(mockExportLibraryJson).toHaveBeenCalledWith({
      entities: mockEntities,
      claims: [],
      graph: undefined,
      mindMap: undefined,
      links: undefined,
      tags: undefined,
    })
    expect(mockSetCommandOpen).toHaveBeenCalledWith(false)
  })

  it('cycles the theme light → dark from the palette', () => {
    commandOpen = true
    mockTheme = 'light'
    render(<CommandPalette {...defaultProps} />)
    fireEvent.click(screen.getByText('Toggle theme').closest('[role="option"]')!)
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
    expect(mockSetCommandOpen).toHaveBeenCalledWith(false)
  })

  it('cycles the theme dark → system from the palette', () => {
    commandOpen = true
    mockTheme = 'dark'
    render(<CommandPalette {...defaultProps} />)
    fireEvent.click(screen.getByText('Toggle theme').closest('[role="option"]')!)
    expect(mockSetTheme).toHaveBeenCalledWith('system')
  })

  it('cycles the theme system → light from the palette', () => {
    commandOpen = true
    mockTheme = 'system'
    render(<CommandPalette {...defaultProps} />)
    fireEvent.click(screen.getByText('Toggle theme').closest('[role="option"]')!)
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('treats an unmounted theme choice as system when toggling', () => {
    commandOpen = true
    // The hydration-safe hook reports `undefined` until mount.
    mockTheme = undefined
    render(<CommandPalette {...defaultProps} />)
    fireEvent.click(screen.getByText('Toggle theme').closest('[role="option"]')!)
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })
})
