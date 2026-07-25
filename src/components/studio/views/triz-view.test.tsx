import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, transition: _t, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Grid3X3: Icon,
    ArrowRight: Icon,
    RotateCcw: Icon,
    Copy: Icon,
    Check: Icon,
    Search: Icon,
    Sparkles: Icon,
    Eye: Icon,
    List: Icon,
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const { mockParameters, mockPrinciples, mockMatrix, mockLookupPrinciples } = vi.hoisted(() => {
  const mockParameters = [
    'Weight of moving object',
    'Length of moving object',
    'Speed',
    'Temperature',
  ]

  const mockPrinciples = [
    { id: 1, name: 'Segmentation', description: 'Divide into parts', examples: ['Modular furniture'] },
    { id: 2, name: 'Extraction', description: 'Separate parts', examples: ['Noise canceling'] },
    { id: 3, name: 'Local quality', description: 'Optimize locally', examples: ['Gradient lenses'] },
  ]

  const mockMatrix: Record<string, number[]> = {
    '0-1': [1, 2],
    '1-0': [3],
    '2-3': [1, 3],
  }

  const mockLookupPrinciples = vi.fn((improving: number, worsening: number) => {
    const key = `${improving}-${worsening}`
    const ids = mockMatrix[key] ?? []
    return ids.map((id) => mockPrinciples.find((p) => p.id === id)).filter(Boolean) as typeof mockPrinciples
  })

  return { mockParameters, mockPrinciples, mockMatrix, mockLookupPrinciples }
})

vi.mock('@/lib/studio/triz-data', () => ({
  TRIZ_PARAMETERS: mockParameters,
  TRIZ_PRINCIPLES: mockPrinciples,
  TRIZ_MATRIX: mockMatrix,
  lookupPrinciples: mockLookupPrinciples,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

vi.mock('../ui/shared-primitives', () => ({
  TextInput: ({ placeholder, value, onChange, className }: { placeholder?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; className?: string }) => (
    <input data-testid="text-input" placeholder={placeholder} value={value} onChange={onChange} className={className} />
  ),
  ToggleButtonGroup: ({ children }: { label?: string; children?: React.ReactNode }) => (
    <div data-testid="toggle-group">{children}</div>
  ),
}))

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({}),
}))

import { TrizView } from './triz-view'

describe('TrizView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders TRIZ header and title', () => {
    render(<TrizView />)
    expect(screen.getByText('TRIZ Contradiction Matrix')).toBeDefined()
    expect(screen.getByText('Lab')).toBeDefined()
  })

  it('shows Pick view by default', () => {
    render(<TrizView />)
    expect(screen.getByText('Improving parameter')).toBeDefined()
    expect(screen.getByText('Worsening parameter')).toBeDefined()
  })

  it('renders improving parameter picker with search input', () => {
    render(<TrizView />)
    expect(screen.getByText('What you want to make better')).toBeDefined()
    const searchInputs = screen.getAllByPlaceholderText('Search parameters\u2026')
    expect(searchInputs.length).toBeGreaterThanOrEqual(1)
  })

  it('renders worsening parameter picker with search input', () => {
    render(<TrizView />)
    expect(screen.getByText('What gets worse as a result')).toBeDefined()
    const searchInputs = screen.getAllByPlaceholderText('Search parameters\u2026')
    expect(searchInputs.length).toBeGreaterThanOrEqual(2)
  })

  it('search input exists for filtering parameters', () => {
    render(<TrizView />)
    const searchInputs = screen.getAllByPlaceholderText('Search parameters\u2026')
    expect(searchInputs.length).toBeGreaterThan(0)
  })

  it('displays all parameters in pickers', () => {
    render(<TrizView />)
    expect(screen.getAllByText('Weight of moving object').length).toBe(2)
    expect(screen.getAllByText('Length of moving object').length).toBe(2)
    expect(screen.getAllByText('Speed').length).toBe(2)
    expect(screen.getAllByText('Temperature').length).toBe(2)
  })

  it('selecting improving parameter works', () => {
    render(<TrizView />)
    const buttons = screen.getAllByText('Weight of moving object')
    fireEvent.click(buttons[0])
    expect(screen.getAllByText('Length of moving object').length).toBe(2)
  })

  it('selecting worsening parameter works', () => {
    render(<TrizView />)
    const buttons = screen.getAllByText('Speed')
    fireEvent.click(buttons[1])
    expect(screen.getAllByText('Weight of moving object').length).toBe(2)
  })

  it('auto-navigates to Results when both parameters selected', () => {
    render(<TrizView />)
    fireEvent.click(screen.getAllByText('Weight of moving object')[0])
    fireEvent.click(screen.getAllByText('Length of moving object')[1])
    expect(screen.getByText('Your contradiction')).toBeDefined()
    expect(screen.getByText('Suggested inventive principles')).toBeDefined()
  })

  it('results view shows suggested principles', () => {
    render(<TrizView />)
    fireEvent.click(screen.getAllByText('Weight of moving object')[0])
    fireEvent.click(screen.getAllByText('Length of moving object')[1])
    expect(screen.getByText('Segmentation')).toBeDefined()
    expect(screen.getByText('Extraction')).toBeDefined()
    expect(screen.getByText('Divide into parts')).toBeDefined()
  })

  it('copy principle button exists in results', () => {
    render(<TrizView />)
    fireEvent.click(screen.getAllByText('Weight of moving object')[0])
    fireEvent.click(screen.getAllByText('Length of moving object')[1])
    const copyButtons = screen.getAllByLabelText('Copy principle')
    expect(copyButtons.length).toBeGreaterThan(0)
  })

  it('view toggle buttons exist (Pick, Matrix)', () => {
    render(<TrizView />)
    expect(screen.getByText('Pick')).toBeDefined()
    expect(screen.getByText('Matrix')).toBeDefined()
  })

  it('matrix view shows when toggled', () => {
    render(<TrizView />)
    fireEvent.click(screen.getByText('Matrix'))
    expect(screen.getByText('Contradiction Matrix')).toBeDefined()
    expect(screen.getByText(/\d+ parameters/)).toBeDefined()
  })

  it('reset button clears selections and returns to pick', () => {
    render(<TrizView />)
    fireEvent.click(screen.getAllByText('Weight of moving object')[0])
    fireEvent.click(screen.getAllByText('Length of moving object')[1])
    expect(screen.getByText('Your contradiction')).toBeDefined()
    fireEvent.click(screen.getByText('Reset'))
    expect(screen.getByText('Improving parameter')).toBeDefined()
    expect(screen.getByText('Worsening parameter')).toBeDefined()
  })

  it('matrix view has filter input', () => {
    render(<TrizView />)
    fireEvent.click(screen.getByText('Matrix'))
    expect(screen.getByPlaceholderText('Filter parameters\u2026')).toBeDefined()
  })

  it('results show contradiction summary with selected parameters', () => {
    render(<TrizView />)
    fireEvent.click(screen.getAllByText('Weight of moving object')[0])
    fireEvent.click(screen.getAllByText('Length of moving object')[1])
    expect(screen.getByText(/You want to improve/)).toBeDefined()
    expect(screen.getByText(/but doing so worsens/)).toBeDefined()
  })

  it('reset button appears only when parameters are selected', () => {
    render(<TrizView />)
    expect(screen.queryByText('Reset')).toBeNull()
  })
})
