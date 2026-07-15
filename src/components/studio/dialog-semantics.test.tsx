import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommandPalette } from './command-palette'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    section: ({ children, initial: _i, animate: _a, transition: _t, ...props }: Record<string, unknown>) => (
      <section {...props}>{children as React.ReactNode}</section>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock cmdk
vi.mock('cmdk', () => ({
  Command: Object.assign(
    ({ children, label, ...props }: Record<string, unknown>) => (
      <div aria-label={label as string} {...props}>
        {children as React.ReactNode}
      </div>
    ),
    {
      Input: (props: Record<string, unknown>) => <input {...(props as object)} />,
      List: ({ children, ...props }: Record<string, unknown>) => (
        <div {...props}>{children as React.ReactNode}</div>
      ),
      Empty: ({ children, ...props }: Record<string, unknown>) => (
        <div {...props}>{children as React.ReactNode}</div>
      ),
      Group: ({ children, heading, ...props }: Record<string, unknown>) => (
        <div aria-label={heading as string} {...props}>
          {children as React.ReactNode}
        </div>
      ),
      Item: ({ children, onSelect: _on, value: _v, ...props }: Record<string, unknown>) => (
        <div {...props}>{children as React.ReactNode}</div>
      ),
    },
  ),
}))

// Mock lucide-react icons
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
    Search: Icon,
    CornerDownLeft: Icon,
  }
})

// Store mock state
const mockState: Record<string, unknown> = {
  commandOpen: false,
  setCommandOpen: vi.fn(),
  setView: vi.fn(),
  startNew: vi.fn(),
  entities: [],
  startEdit: vi.fn(),
}

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(mockState),
}))

describe('CommandPalette', () => {
  beforeEach(() => {
    mockState.commandOpen = false
    mockState.entities = []
  })

  it('renders nothing when commandOpen is false', () => {
    const { container } = render(<CommandPalette />)
    expect(container.innerHTML).toBe('')
  })

  it('renders with dialog role and aria-modal when open', () => {
    mockState.commandOpen = true
    const { container } = render(<CommandPalette />)
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeDefined()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-label')).toBe('Command palette')
  })

  it('renders search input when open', () => {
    mockState.commandOpen = true
    render(<CommandPalette />)
    const input = screen.getByPlaceholderText('Search commands and entities\u2026')
    expect(input).toBeDefined()
  })

  it('renders navigation items when open', () => {
    mockState.commandOpen = true
    render(<CommandPalette />)
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('Library')).toBeDefined()
    expect(screen.getByText('Graph')).toBeDefined()
  })
})
