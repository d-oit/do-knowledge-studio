import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { CommandPalette } from './command-palette'

vi.mock('framer-motion', () => {
  const div = ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
    <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
  )
  const section = ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: ReactNode; [key: string]: unknown }) => (
    <section {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</section>
  )
  return { motion: { div, section }, AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</> }
})

// Mock cmdk — typed mock props with explicit children/label
type CmdkMockProps = { children?: ReactNode; label?: string; heading?: string; onSelect?: () => void; value?: string; [key: string]: unknown }

vi.mock('cmdk', () => ({
  Command: Object.assign(
    ({ children, label, ...props }: CmdkMockProps) => (
      <div aria-label={label} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    ),
    {
      Input: ({ children: _c, ...props }: CmdkMockProps) => <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />,
      List: ({ children, ...props }: CmdkMockProps) => (
        <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
      Empty: ({ children, ...props }: CmdkMockProps) => (
        <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
      Group: ({ children, heading, ...props }: CmdkMockProps) => (
        <div aria-label={heading} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      ),
      Item: ({ children, onSelect: _on, value: _v, ...props }: CmdkMockProps) => (
        <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
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
