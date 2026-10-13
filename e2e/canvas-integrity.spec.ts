import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { navClick, waitForAppReady } from './helpers/navigation'

const STORE_KEY = 'do-knowledge-studio-store'
const fixtureDirs: string[] = []


const readPersistedCanvas = async (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) return null
    const state: unknown = parsed.state
    if (typeof state !== 'object' || state === null) return null
    const graph = 'graph' in state ? state.graph : undefined
    const mindMap = 'mindMap' in state ? state.mindMap : undefined
    const ids = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.flatMap((entry: unknown): string[] =>
            typeof entry === 'object' && entry !== null && 'id' in entry && typeof entry.id === 'string'
              ? [entry.id]
              : [],
          )
        : []
    return {
      entityIds: 'entities' in state ? ids(state.entities) : [],
      graphNodeIds:
        typeof graph === 'object' && graph !== null && 'nodes' in graph ? ids(graph.nodes) : [],
      graphEdgeCount:
        typeof graph === 'object' && graph !== null && 'edges' in graph && Array.isArray(graph.edges)
          ? graph.edges.length
          : 0,
      mindMapNodeIds:
        typeof mindMap === 'object' && mindMap !== null && 'nodes' in mindMap ? ids(mindMap.nodes) : [],
      links: 'links' in state && Array.isArray(state.links) ? state.links.length : 0,
    }
  }, STORE_KEY)

const writeFixture = async (name: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'dks-canvas-'))
  fixtureDirs.push(dir)
  const path = join(dir, `${name}.json`)
  const timestamp = '2026-01-01T00:00:00.000Z'
  const entity = (id: string, name: string) => ({
    id,
    name,
    type: 'concept',
    description: '',
    content: '',
    tags: [],
    links: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await writeFile(
    path,
    JSON.stringify({
      version: 1,
      exportedAt: timestamp,
      entities: [entity('e1', 'Node Alpha'), entity('e2', 'Node Beta')],
      claims: [],
      graph: {
        nodes: [
          { id: 'e1', label: 'Node Alpha', type: 'concept', x: 0, y: 0 },
          { id: 'e2', label: 'Node Beta', type: 'concept', x: 120, y: 0 },
        ],
        edges: [{ id: 'g1', source: 'e1', target: 'e2', relation: 'relates' }],
      },
      mindMap: {
        nodes: [
          { id: 'e1', label: 'Node Alpha', type: 'concept' },
          { id: 'e2', label: 'Node Beta', type: 'concept' },
        ],
        edges: [],
      },
      links: [{ id: 'l1', sourceId: 'e1', targetId: 'e2', type: 'relates', createdAt: timestamp }],
      tags: [],
    }),
  )
  return path
}

const importJson = async (page: Page, fixture: string): Promise<void> => {
  await navClick(page, /^export/i)
  await page.locator('input[type=file]').setInputFiles(fixture)
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click()
}

const deleteAlphaFromGraph = async (page: Page, fixture: string): Promise<void> => {
  await importJson(page, fixture)
  await navClick(page, /^graph/i)
  await page.getByRole('button', { name: /Node Alpha/ }).click()
  await page.keyboard.press('Delete')
}

test.afterAll(async () => {
  await Promise.all(fixtureDirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

test('deleting an entity prunes persisted canvas references', async ({ page }) => {
  const fixture = await writeFixture('canvas-delete')
  await page.goto('/')
  await waitForAppReady(page)
  await deleteAlphaFromGraph(page, fixture)

  await expect.poll(() => readPersistedCanvas(page)).toEqual({
    entityIds: ['e2'],
    graphNodeIds: ['e2'],
    graphEdgeCount: 0,
    mindMapNodeIds: ['e2'],
    links: 0,
  })
})

test('JSON export omits a deleted entity from canvas data', async ({ page }) => {
  const fixture = await writeFixture('canvas-export')
  await page.goto('/')
  await waitForAppReady(page)
  await deleteAlphaFromGraph(page, fixture)
  await navClick(page, /^export/i)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /JSON/ }).first().click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const payload = Buffer.concat(chunks).toString('utf8')

  expect(payload).not.toContain('"e1"')
})
