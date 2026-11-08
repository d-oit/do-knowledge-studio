import { describe, expect, it, vi, type Mock } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { RoomProvider } from '@/lib/sync'
import type { IceServerConfig } from '@/lib/sync/ice-config'
import { SyncConnectionPanel } from './sync-connection-panel'

const mocks = vi.hoisted(() => ({
  saveIceServerSettings: vi.fn(async (_servers: IceServerConfig[]) => undefined),
}))

vi.mock('@/lib/sync/ice-settings', () => ({
  saveIceServerSettings: mocks.saveIceServerSettings,
  loadIceServerSettings: async () => [],
}))

/** Provider stub: only the fields the diagnostics read. */
const unreachableProvider = {
  connected: false,
  signalingUrls: ['wss://signaling.example.com:4444'],
  room: null,
} as unknown as RoomProvider

/** Renders the panel inside `act` so the initial snapshot read settles. */
const renderPanel = async (overrides: {
  provider?: RoomProvider | null
  peerCount?: number
  roomActive?: boolean
  iceServers?: IceServerConfig[]
} = {}): Promise<{
  onIceServersChange: Mock<(servers: IceServerConfig[]) => void>
  onOpenFileSync: Mock<() => void>
}> => {
  const onIceServersChange = vi.fn<(servers: IceServerConfig[]) => void>()
  const onOpenFileSync = vi.fn<() => void>()
  await act(async () => {
    render(
      <SyncConnectionPanel
        provider={overrides.provider ?? null}
        peerCount={overrides.peerCount ?? 0}
        roomActive={overrides.roomActive ?? false}
        iceServers={overrides.iceServers ?? []}
        onIceServersChange={onIceServersChange}
        onOpenFileSync={onOpenFileSync}
      />,
    )
  })
  return { onIceServersChange, onOpenFileSync }
}

/** The URL field has no accessible name collision, so it is found by placeholder. */
const urlInput = (): HTMLElement => screen.getByPlaceholderText('turns:relay.example.com:5349')

describe('SyncConnectionPanel diagnostics', () => {
  it('reports that no room is joined and no relay is configured', async () => {
    await renderPanel()
    expect(screen.getByText('Connection diagnostics')).toBeDefined()
    expect(screen.getByText('No room joined')).toBeDefined()
    expect(screen.getByText('No relay configured. Only STUN defaults apply.')).toBeDefined()
  })

  it('explains an unreachable signaling server and offers both fallbacks', async () => {
    const { onOpenFileSync } = await renderPanel({ provider: unreachableProvider, roomActive: true })
    expect(await screen.findByText('Direct connection is blocked')).toBeDefined()
    expect(
      screen.getByText(/The signaling server could not be reached/),
    ).toBeDefined()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync via file' }))
    })
    expect(onOpenFileSync).toHaveBeenCalledTimes(1)
  })
})

describe('SyncConnectionPanel ICE settings', () => {
  it('rejects a plaintext TURN URL on a public host without saving', async () => {
    await renderPanel()
    fireEvent.change(urlInput(), { target: { value: 'turn:relay.example.com:3478' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add server' }))
    })

    // Two issues: the insecure scheme and the missing credential a TURN URL needs.
    expect(screen.getByText('2 problem(s) with the ICE configuration')).toBeDefined()
    expect(screen.getByText(/Plaintext turn: relays expose credentials/)).toBeDefined()
    expect(mocks.saveIceServerSettings).not.toHaveBeenCalled()
  })

  it('persists a valid server and reports it to the view', async () => {
    const { onIceServersChange } = await renderPanel()
    fireEvent.change(urlInput(), { target: { value: 'stun:stun.example.com:3478' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add server' }))
    })

    expect(mocks.saveIceServerSettings).toHaveBeenCalledWith([
      { urls: ['stun:stun.example.com:3478'] },
    ])
    expect(onIceServersChange).toHaveBeenCalledWith([{ urls: ['stun:stun.example.com:3478'] }])
  })

  it('removes a configured relay without exposing its credential', async () => {
    const servers: IceServerConfig[] = [
      { urls: ['turns:relay.example.com:5349'], username: 'relay-user', credential: 'relay-secret' },
    ]
    await renderPanel({ iceServers: servers })
    expect(screen.getByText('credentials stored')).toBeDefined()
    expect(screen.queryByText(/relay-secret/)).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    })
    expect(mocks.saveIceServerSettings).toHaveBeenCalledWith([])
  })
})
