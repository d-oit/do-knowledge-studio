import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return { AlertTriangle: Icon, Check: Icon, X: Icon, ChevronDown: Icon, ChevronUp: Icon }
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

import { ConflictUI } from './conflict-ui'
import type { FieldConflict } from '@/lib/sync/merge'

const makeConflict = (overrides: Partial<FieldConflict> = {}): FieldConflict => ({
  entityId: 'ent-1',
  entityType: 'entity',
  field: 'name',
  localValue: 'Local Name',
  remoteValue: 'Remote Name',
  winner: 'local',
  reason: 'Both sides modified the same field',
  ...overrides,
})

const defaultProps = {
  conflicts: [makeConflict()],
  onResolve: vi.fn(),
  onDismiss: vi.fn(),
}

describe('ConflictUI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when conflicts is empty', () => {
    const { container } = render(<ConflictUI {...defaultProps} conflicts={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders single conflict count', () => {
    render(<ConflictUI {...defaultProps} />)
    expect(screen.getByText('1 conflict detected')).toBeDefined()
  })

  it('renders plural conflict count', () => {
    render(<ConflictUI {...defaultProps} conflicts={[makeConflict(), makeConflict({ entityId: 'ent-2' })]} />)
    expect(screen.getByText('2 conflicts detected')).toBeDefined()
  })

  it('renders Keep all local button', () => {
    render(<ConflictUI {...defaultProps} />)
    expect(screen.getByText('Keep all local')).toBeDefined()
  })

  it('renders Keep all remote button', () => {
    render(<ConflictUI {...defaultProps} />)
    expect(screen.getByText('Keep all remote')).toBeDefined()
  })

  it('renders Dismiss button', () => {
    render(<ConflictUI {...defaultProps} />)
    expect(screen.getByText('Dismiss')).toBeDefined()
  })

  it('renders Apply resolutions button', () => {
    render(<ConflictUI {...defaultProps} />)
    expect(screen.getByText('Apply resolutions')).toBeDefined()
  })

  it('calls onDismiss when Dismiss is clicked', () => {
    const onDismiss = vi.fn()
    render(<ConflictUI {...defaultProps} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Dismiss'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('calls onResolve when Apply resolutions is clicked', () => {
    const onResolve = vi.fn()
    render(<ConflictUI {...defaultProps} onResolve={onResolve} />)
    fireEvent.click(screen.getByText('Apply resolutions'))
    expect(onResolve).toHaveBeenCalled()
  })

  it('shows conflict field name', () => {
    render(<ConflictUI {...defaultProps} />)
    expect(screen.getByText('name')).toBeDefined()
  })

  it('shows entity type', () => {
    render(<ConflictUI {...defaultProps} />)
    expect(screen.getByText('entity')).toBeDefined()
  })

  it('expands conflict details on click', () => {
    render(<ConflictUI {...defaultProps} />)
    // Click the expand button (the one with entity type and field)
    fireEvent.click(screen.getByText('entity'))
    // Should show Local/Remote labels and values
    expect(screen.getByText('Local Name')).toBeDefined()
    expect(screen.getByText('Remote Name')).toBeDefined()
    expect(screen.getByText('Both sides modified the same field')).toBeDefined()
  })

  it('collapses conflict details on second click', () => {
    render(<ConflictUI {...defaultProps} />)
    fireEvent.click(screen.getByText('entity'))
    // Values should be visible
    expect(screen.getByText('Local Name')).toBeDefined()
    fireEvent.click(screen.getByText('entity'))
    // Values should be hidden
    expect(screen.queryByText('Local Name')).toBeNull()
  })

  it('Local/Remote resolution buttons exist per conflict', () => {
    render(<ConflictUI {...defaultProps} />)
    const localBtns = screen.getAllByText('Local')
    const remoteBtns = screen.getAllByText('Remote')
    expect(localBtns.length).toBeGreaterThanOrEqual(1)
    expect(remoteBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('Keep all local sets all resolutions to local', () => {
    const onResolve = vi.fn()
    render(<ConflictUI {...defaultProps} onResolve={onResolve} />)
    fireEvent.click(screen.getByText('Keep all local'))
    fireEvent.click(screen.getByText('Apply resolutions'))
    const resolutions = onResolve.mock.calls[0][0] as Map<string, string>
    expect(resolutions.get('ent-1:name')).toBe('local')
  })

  it('Keep all remote sets all resolutions to remote', () => {
    const onResolve = vi.fn()
    render(<ConflictUI {...defaultProps} onResolve={onResolve} />)
    fireEvent.click(screen.getByText('Keep all remote'))
    fireEvent.click(screen.getByText('Apply resolutions'))
    const resolutions = onResolve.mock.calls[0][0] as Map<string, string>
    expect(resolutions.get('ent-1:name')).toBe('remote')
  })

  it('handles multiple conflicts', () => {
    const conflicts = [
      makeConflict({ entityId: 'ent-1', field: 'name' }),
      makeConflict({ entityId: 'ent-2', field: 'description', localValue: 'LD', remoteValue: 'RD' }),
    ]
    render(<ConflictUI {...defaultProps} conflicts={conflicts} />)
    expect(screen.getByText('2 conflicts detected')).toBeDefined()
  })

  it('formats empty values as (empty)', () => {
    render(<ConflictUI {...defaultProps} conflicts={[makeConflict({ localValue: null })]} />)
    fireEvent.click(screen.getByText('entity'))
    expect(screen.getByText('(empty)')).toBeDefined()
  })

  it('formats empty string as (empty)', () => {
    render(<ConflictUI {...defaultProps} conflicts={[makeConflict({ localValue: '' })]} />)
    fireEvent.click(screen.getByText('entity'))
    // Both local (empty) and remote values should show
    const empties = screen.getAllByText('(empty)')
    expect(empties.length).toBeGreaterThanOrEqual(1)
  })

  it('formats array values with commas', () => {
    render(<ConflictUI {...defaultProps} conflicts={[makeConflict({ localValue: ['a', 'b', 'c'] })]} />)
    fireEvent.click(screen.getByText('entity'))
    expect(screen.getByText('a, b, c')).toBeDefined()
  })

  it('formats empty array as (empty)', () => {
    render(<ConflictUI {...defaultProps} conflicts={[makeConflict({ localValue: [] })]} />)
    fireEvent.click(screen.getByText('entity'))
    const empties = screen.getAllByText('(empty)')
    expect(empties.length).toBeGreaterThanOrEqual(1)
  })
})
