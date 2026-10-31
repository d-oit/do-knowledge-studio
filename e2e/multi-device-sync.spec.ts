import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { seedStore, type PersistedStudioState } from './helpers/store'
import { navClick, waitForAppReady } from './helpers/navigation'
import {
  canonicalEntityNames,
  createEntity,
  deleteEntityFromGraph,
  editorContent,
  expectEntityContent,
  expectEntityHidden,
  expectEntityVisible,
  joinSyncRoom,
  openEntity,
  readCanonicalEnvelope,
  SYNC_ORIGIN_A,
  SYNC_ORIGIN_B,
  waitForPeer,
} from './helpers/sync'
import { createInvite } from '../src/lib/sync/invite'

/**
 * Independent-peer acceptance suite (Issue #1041).
 *
 * Two Chromium contexts are pointed at different origins (`localhost` and
 * `127.0.0.1`) in the same Next.js deployment, so they cannot use the
 * same-origin BroadcastChannel shortcut that `y-webrtc` uses between tabs.
 * Exchange therefore proves a real WebRTC peer connection through the local
 * signaling service configured in `playwright.config.ts`.
 *
 * Notes are never logged. Assertions read visible UI text or the canonical
 * IndexedDB corpus; no note content is printed by the test itself.
 */

const CONTEXT_OPTIONS = { viewport: { width: 1600, height: 1000 } } as const
const ROOM_TIMEOUT_MS = 45_000
const PROPAGATION_TIMEOUT_MS = 60_000

interface Device {
  context: BrowserContext
  page: Page
  origin: string
}

const makeEntity = (id: string, name: string, content: string) => ({
  id,
  name,
  type: 'note' as const,
  description: `${name} description`,
  content,
  tags: ['sync-e2e'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

const openDevice = async (
  browser: Browser,
  origin: string,
  seed: Partial<PersistedStudioState>,
): Promise<Device> => {
  const context = await browser.newContext(CONTEXT_OPTIONS)
  const page = await context.newPage()
  await seedStore(page, seed)
  await page.goto(origin)
  await waitForAppReady(page)
  return { context, page, origin }
}

const roomId = (): string => `sync-e2e-${randomUUID()}`

/** Read the content of one entity from the canonical corpus. */
const canonicalContent = async (device: Device, name: string): Promise<string | undefined> => {
  const envelope = await readCanonicalEnvelope(device.page)
  return envelope?.state?.entities?.find((entity) => entity.name === name)?.content
}

test.describe.configure({ mode: 'serial' })

test.describe('independent-peer multi-device sync', () => {
  test.setTimeout(180_000)

  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== 'chromium',
      'Independent-peer WebRTC exchange runs on desktop Chromium only.',
    )
  })

  test('exchanges creates, updates, deletes, reloads, and offline tombstones across origins', async ({ browser }) => {
    const nameA = `Alpha sync ${randomUUID().slice(0, 8)}`
    const nameB = `Beta sync ${randomUUID().slice(0, 8)}`
    const created = `Created on A ${randomUUID().slice(0, 8)}`
    const updated = 'Content updated by B while connected'
    const offlineUpdate = 'Content edited by A while offline'
    const room = roomId()

    const deviceA = await openDevice(browser, SYNC_ORIGIN_A, {
      entities: [makeEntity('sync-a', nameA, 'A initial content')],
      claims: [],
    })
    const deviceB = await openDevice(browser, SYNC_ORIGIN_B, {
      entities: [makeEntity('sync-b', nameB, 'B initial content')],
      claims: [],
    })

      await joinSyncRoom(deviceA.page, room, 'correct horse battery staple')
      await joinSyncRoom(deviceB.page, room, 'correct horse battery staple')
      await waitForPeer(deviceA.page)
      await waitForPeer(deviceB.page)

      // Join merges both pre-existing corpora in both directions.
      await expectEntityVisible(deviceA.page, nameB)
      await expectEntityVisible(deviceB.page, nameA)

      // Create on A reaches B.
      await createEntity(deviceA.page, created, 'Created content')
      await expectEntityVisible(deviceB.page, created)

      // Update on B reaches A.
      await openEntity(deviceB.page, created)
      await editorContent(deviceB.page).fill(updated)
      await deviceB.page.getByRole('button', { name: /save to library|commit changes/i }).click()
      await expectEntityContent(deviceA.page, created, updated)

      // Disconnected edit on A is not visible on B until A rejoins. Chromium's
      // offline emulation does not reliably recover WebRTC ICE state, so the
      // acceptance suite models a transport disconnect by leaving the room;
      // reloading proves the edit survived persistence before reconnecting.
      await navClick(deviceA.page, /sync/i)
      await deviceA.page.getByRole('button', { name: 'Leave' }).click()
      await expect(deviceA.page.getByRole('button', { name: 'Join' })).toBeVisible()
      await openEntity(deviceA.page, created)
      await editorContent(deviceA.page).fill(offlineUpdate)
      await deviceA.page.getByRole('button', { name: /save to library|commit changes/i }).click()
      await expect.poll(async () => canonicalContent(deviceB, created), { timeout: 5_000 })
        .toBe(updated)
      await joinSyncRoom(deviceA.page, room, 'correct horse battery staple')
      await navClick(deviceB.page, /sync/i)
      await waitForPeer(deviceA.page)
      await expect.poll(async () => canonicalContent(deviceB, created), { timeout: 60_000 })
        .toBe(offlineUpdate)
      await expectEntityContent(deviceB.page, created, offlineUpdate)

      // A deletion made while disconnected becomes a tombstone on rejoin.
      await navClick(deviceA.page, /sync/i)
      await deviceA.page.getByRole('button', { name: 'Leave' }).click()
      await expect(deviceA.page.getByRole('button', { name: 'Join' })).toBeVisible()
      await deleteEntityFromGraph(deviceA.page, nameB)
      await expectEntityVisible(deviceB.page, nameB)
      await joinSyncRoom(deviceA.page, room, 'correct horse battery staple')
      await navClick(deviceB.page, /sync/i)
      await waitForPeer(deviceA.page)
      await expectEntityHidden(deviceB.page, nameB)
      await expectEntityHidden(deviceA.page, nameB)

      // Reload the converged peer and compare canonical corpora. The provider
      // is intentionally not re-joined here: this assertion is about durable
      // persistence, not transport recovery.
      const beforeReload = await canonicalEntityNames(deviceA.page)
      await deviceB.page.reload()
      await waitForAppReady(deviceB.page)
      await expectEntityVisible(deviceB.page, created)
      const afterReload = await canonicalEntityNames(deviceB.page)
      expect(afterReload).toEqual(beforeReload)
      expect(afterReload).not.toContain(nameB)
  })

  test('concurrent edits converge to one deterministic value without phantom records', async ({ browser }) => {
    const shared = `Concurrent ${randomUUID().slice(0, 8)}`
    const room = roomId()
    const deviceA = await openDevice(browser, SYNC_ORIGIN_A, {
      entities: [makeEntity('sync-shared', shared, 'shared initial')],
      claims: [],
    })
    const deviceB = await openDevice(browser, SYNC_ORIGIN_B, {
      entities: [makeEntity('sync-shared', shared, 'shared initial')],
      claims: [],
    })

      await joinSyncRoom(deviceA.page, room, 'concurrency password')
      await joinSyncRoom(deviceB.page, room, 'concurrency password')
      await waitForPeer(deviceA.page)
      await waitForPeer(deviceB.page)

      await openEntity(deviceA.page, shared)
      await openEntity(deviceB.page, shared)
      await Promise.all([
        editorContent(deviceA.page).fill('concurrent edit from A'),
        editorContent(deviceB.page).fill('concurrent edit from B'),
      ])
      await Promise.all([
        deviceA.page.getByRole('button', { name: /save to library|commit changes/i }).click(),
        deviceB.page.getByRole('button', { name: /save to library|commit changes/i }).click(),
      ])

      await expect.poll(
        async () => {
          const [a, b] = await Promise.all([canonicalContent(deviceA, shared), canonicalContent(deviceB, shared)])
          if (a === undefined || b === undefined) return 'missing'
          return a === b ? a : `divergent:${a}|${b}`
        },
        { timeout: PROPAGATION_TIMEOUT_MS },
      ).toMatch(/^(concurrent edit from A|concurrent edit from B)$/)

      // The conflict path must not duplicate the record.
      await expect.poll(async () => {
        const [a, b] = await Promise.all([
          readCanonicalEnvelope(deviceA.page),
          readCanonicalEnvelope(deviceB.page),
        ])
        const countA = a?.state?.entities?.filter((entity) => entity.name === shared).length ?? 0
        const countB = b?.state?.entities?.filter((entity) => entity.name === shared).length ?? 0
        return `${countA}:${countB}`
      }, { timeout: PROPAGATION_TIMEOUT_MS }).toBe('1:1')
  })

  test('wrong-password peers never exchange data and expired invites are refused', async ({ browser }) => {
    const nameA = `Secret A ${randomUUID().slice(0, 8)}`
    const nameB = `Secret B ${randomUUID().slice(0, 8)}`
    const room = roomId()
    const deviceA = await openDevice(browser, SYNC_ORIGIN_A, {
      entities: [makeEntity('sync-secret-a', nameA, 'secret A')],
      claims: [],
    })
    const deviceB = await openDevice(browser, SYNC_ORIGIN_B, {
      entities: [makeEntity('sync-secret-b', nameB, 'secret B')],
      claims: [],
    })

      await joinSyncRoom(deviceA.page, room, 'alpha password')
      await joinSyncRoom(deviceB.page, room, 'beta password')
      await deviceA.page.waitForTimeout(8_000)
      await expectEntityVisible(deviceA.page, nameA)
      await expectEntityHidden(deviceA.page, nameB)
      await expectEntityVisible(deviceB.page, nameB)
      await expectEntityHidden(deviceB.page, nameA)

      // A second, clean room verifies expired invite tokens are rejected locally.
      const expired = createInvite(roomId(), 1, Date.now() - 10_000)
      await navClick(deviceA.page, /sync/i)
      await deviceA.page.getByRole('button', { name: /leave/i }).click()
      await deviceA.page.getByLabel('Room ID').fill(expired)
      await deviceA.page.getByRole('button', { name: 'Join' }).click()
      await expect(deviceA.page.getByRole('button', { name: 'Leave' })).toHaveCount(0)
      await expect(deviceA.page.getByText(/expired/i).first()).toBeVisible()
  })

  test('optional 1k-entity stress stays within a bounded sync window', async ({ browser }) => {
    test.skip(process.env.SYNC_STRESS !== '1', 'Set SYNC_STRESS=1 to run the bounded stress scenario.')
    const room = roomId()
    const makeCorpus = (prefix: string) => ({
      entities: Array.from({ length: 1_000 }, (_, index) =>
        makeEntity(`${prefix}-${index}`, `${prefix} entity ${index}`, `content ${index}`),
      ),
      claims: [],
    })
    const started = Date.now()
    const deviceA = await openDevice(browser, SYNC_ORIGIN_A, makeCorpus('stress-a'))
    const deviceB = await openDevice(browser, SYNC_ORIGIN_B, makeCorpus('stress-b'))
      await joinSyncRoom(deviceA.page, room, 'stress password')
      await joinSyncRoom(deviceB.page, room, 'stress password')
      await expect.poll(async () => {
        const envelope = await readCanonicalEnvelope(deviceB.page)
        return envelope?.state?.entities?.length ?? 0
      }, { timeout: ROOM_TIMEOUT_MS }).toBe(2_000)
      expect(Date.now() - started).toBeLessThan(120_000)
  })
})
