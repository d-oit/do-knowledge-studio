import { expect, type Page } from '@playwright/test'
import { navClick, waitForAppReady } from './navigation'

/** Two distinct origins; separate origins guarantee no BroadcastChannel path. */
export const SYNC_ORIGIN_A = 'http://localhost:3000'
export const SYNC_ORIGIN_B = 'http://127.0.0.1:3000'

/** Persisted Zustand envelope as read from the canonical IndexedDB store. */
export interface CanonicalEnvelope {
  state?: {
    entities?: { id: string; name: string; content?: string }[]
    claims?: { id: string; entityId: string; statement: string }[]
  }
  version?: number
}

/**
 * Read the canonical corpus from IndexedDB.
 *
 * This is the storage boundary E2E must assert against after Issue #1036; the
 * legacy localStorage key is only a migration source.
 */
export const readCanonicalEnvelope = async (page: Page): Promise<CanonicalEnvelope | null> =>
  page.evaluate(async () => {
    if (typeof indexedDB === 'undefined') return null
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const request = indexedDB.open('dks-canonical', 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('state')) database.createObjectStore('state')
      }
      request.onsuccess = () => { resolve(request.result) }
      request.onerror = () => { resolve(null) }
      request.onblocked = () => { resolve(null) }
    })
    if (db === null) return null
    const value = await new Promise<unknown>((resolve) => {
      const transaction = db.transaction('state', 'readonly')
      const request = transaction.objectStore('state').get('studio-corpus')
      request.onsuccess = () => { resolve(request.result) }
      request.onerror = () => { resolve(null) }
    })
    db.close()
    return value as CanonicalEnvelope | null
  })

/** Navigate to the Sync view and join a room, optionally with a password. */
export const joinSyncRoom = async (
  page: Page,
  roomId: string,
  password?: string,
): Promise<void> => {
  await waitForAppReady(page)
  await navClick(page, /sync/i)
  await expect(page.getByRole('main').getByRole('heading', { name: 'Sync', exact: true })).toBeVisible()
  await page.getByLabel('Room ID').fill(roomId)
  if (password) {
    await page.getByLabel('Room password').fill(password)
  }
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible({ timeout: 45_000 })
}

/** Wait until the provider reports a live peer (not merely room-active). */
export const waitForPeer = async (page: Page): Promise<void> => {
  await expect(page.getByText('Peers connected')).toBeVisible({ timeout: 45_000 })
}

/**
 * The markdown textarea.
 *
 * `getByLabel('Editor content')` is ambiguous while the lazy editor suspends:
 * the fallback `div` is labelled "Editor content loading" and matches the
 * substring first. The explicit textarea locator is the actual editable value.
 */
export const editorContent = (page: Page) =>
  page.locator('textarea[aria-label="Editor content"]')

/** Create an entity through the editor and save it. */
export const createEntity = async (page: Page, name: string, content = ''): Promise<void> => {
  await navClick(page, /editor/i)
  await page.getByRole('button', { name: /new|create|add/i }).first().click()
  await page.locator('#entity-name').fill(name)
  if (content !== '') {
    await editorContent(page).fill(content)
  }
  await page.getByRole('button', { name: /save to library|commit changes/i }).click()
  await expect(page.locator('#entity-name')).toHaveValue(name)
}

/** The Library card/row for an entity (grid and list share the visible name). */
const entityCard = (page: Page, name: string) =>
  page.getByRole('main').getByRole('button').filter({ hasText: name }).first()

/** Open an entity from the Library and return to the editor. */
export const openEntity = async (page: Page, name: string): Promise<void> => {
  await navClick(page, /library/i)
  // The Library keeps its previous search query across navigation; narrow to
  // this entity rather than inheriting a filter that hides it.
  await page.getByLabel('Search library').fill(name)
  await entityCard(page, name).click()
  await expect(page.locator('#entity-name')).toHaveValue(name)
}

/** Replace an entity's content and save from the editor. */
export const updateEntityContent = async (page: Page, name: string, content: string): Promise<void> => {
  await openEntity(page, name)
  await editorContent(page).fill(content)
  await page.getByRole('button', { name: /save to library|commit changes/i }).click()
  await expect(editorContent(page)).toHaveValue(content)
}

/** Delete an entity through the graph inspector. */
export const deleteEntityFromGraph = async (page: Page, name: string): Promise<void> => {
  await navClick(page, /graph/i)
  const graph = page.getByRole('img', { name: /knowledge graph/i })
  await graph.getByRole('button').filter({ hasText: name }).first().click()
  const inspector = page.locator('aside').filter({ hasText: 'Inspector' })
  await inspector.getByRole('button', { name: 'Delete', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Delete entity\?/ })
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(inspector.getByText(name, { exact: true })).toHaveCount(0, { timeout: 20_000 })
}

/** Wait for the entity name to appear in the Library. */
export const expectEntityVisible = async (page: Page, name: string): Promise<void> => {
  await navClick(page, /library/i)
  await page.getByLabel('Search library').fill(name)
  await expect(entityCard(page, name)).toBeVisible({ timeout: 30_000 })
}

/** Wait for the entity name to disappear from the Library. */
export const expectEntityHidden = async (page: Page, name: string): Promise<void> => {
  await navClick(page, /library/i)
  await page.getByLabel('Search library').fill(name)
  await expect(entityCard(page, name)).toHaveCount(0, { timeout: 30_000 })
}

/** Verify content by opening the entity in the editor. */
export const expectEntityContent = async (page: Page, name: string, content: string): Promise<void> => {
  await openEntity(page, name)
  await expect(editorContent(page)).toHaveValue(content, { timeout: 30_000 })
}

/** Read entity names from the canonical corpus, sorted for equality checks. */
export const canonicalEntityNames = async (page: Page): Promise<string[]> => {
  const envelope = await readCanonicalEnvelope(page)
  return (envelope?.state?.entities ?? []).map((entity) => entity.name).sort()
}
