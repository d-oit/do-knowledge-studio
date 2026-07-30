import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

let peers: Array<{ deviceId: string; name: string; color: string; currentView: string }> = []
let peerCount = 1
let localPresence = null as { name: string; color: string; currentView: string } | null

vi.mock('@/lib/sync/use-presence', () => ({
  usePresence: () => ({ peers, peerCount, localPresence }),
}))

import { PresenceIndicator, PresenceList } from './presence-indicator'

describe('PresenceIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    peers = []
    peerCount = 1
    localPresence = null
  })

  it('renders nothing when only 1 peer (self)', () => {
    peerCount = 1
    const { container } = render(<PresenceIndicator />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when peerCount is 0', () => {
    peerCount = 0
    const { container } = render(<PresenceIndicator />)
    expect(container.innerHTML).toBe('')
  })

  it('renders peer avatars when multiple peers', () => {
    peers = [
      { deviceId: 'd1', name: 'Alice', color: '#ff0000', currentView: 'home' },
      { deviceId: 'd2', name: 'Bob', color: '#00ff00', currentView: 'editor' },
    ]
    peerCount = 3
    render(<PresenceIndicator />)
    expect(screen.getByText('A')).toBeDefined()
    expect(screen.getByText('B')).toBeDefined()
  })

  it('shows online count', () => {
    peers = [{ deviceId: 'd1', name: 'Alice', color: '#ff0000', currentView: 'home' }]
    peerCount = 2
    render(<PresenceIndicator />)
    expect(screen.getByText('2 online')).toBeDefined()
  })

  it('shows overflow count when more than 5 peers', () => {
    peers = Array.from({ length: 7 }, (_, i) => ({
      deviceId: `d${i}`,
      name: `User${i}`,
      color: '#ff0000',
      currentView: 'home',
    }))
    peerCount = 8
    render(<PresenceIndicator />)
    expect(screen.getByText('+2')).toBeDefined()
  })

  it('renders at most 5 peer avatars', () => {
    // Use names with unique first letters to avoid ambiguity
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']
    peers = names.map((name, i) => ({
      deviceId: `d${i}`,
      name,
      color: '#ff0000',
      currentView: 'home',
    }))
    peerCount = 7
    render(<PresenceIndicator />)
    // 5 avatars (A, B, C, D, E) + 1 overflow (+1)
    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      expect(screen.getByText(letter)).toBeDefined()
    }
    expect(screen.getByText('+1')).toBeDefined()
  })

  it('applies custom className', () => {
    peers = [{ deviceId: 'd1', name: 'Alice', color: '#ff0000', currentView: 'home' }]
    peerCount = 2
    const { container } = render(<PresenceIndicator className="custom" />)
    expect(container.firstElementChild?.className).toContain('custom')
  })
})

describe('PresenceList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    peers = []
    localPresence = null
  })

  it('renders empty when no peers and no local presence', () => {
    const { container } = render(<PresenceList />)
    // The div exists but has no children
    expect(container.firstElementChild?.children.length).toBe(0)
  })

  it('renders local presence with (you) label', () => {
    localPresence = { name: 'Me', color: '#0000ff', currentView: 'home' }
    render(<PresenceList />)
    expect(screen.getByText('Me')).toBeDefined()
    expect(screen.getByText('(you)')).toBeDefined()
  })

  it('renders remote peers without (you) label', () => {
    peers = [{ deviceId: 'd1', name: 'Alice', color: '#ff0000', currentView: 'editor' }]
    render(<PresenceList />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.queryByText('(you)')).toBeNull()
  })

  it('renders both local and remote peers', () => {
    localPresence = { name: 'Me', color: '#0000ff', currentView: 'home' }
    peers = [{ deviceId: 'd1', name: 'Alice', color: '#ff0000', currentView: 'editor' }]
    render(<PresenceList />)
    expect(screen.getByText('Me')).toBeDefined()
    expect(screen.getByText('Alice')).toBeDefined()
  })

  it('shows current view for each peer', () => {
    localPresence = { name: 'Me', color: '#0000ff', currentView: 'graph' }
    peers = [{ deviceId: 'd1', name: 'Alice', color: '#ff0000', currentView: 'library' }]
    render(<PresenceList />)
    expect(screen.getByText('graph')).toBeDefined()
    expect(screen.getByText('library')).toBeDefined()
  })
})
