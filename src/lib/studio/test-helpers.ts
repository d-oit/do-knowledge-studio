import { useStudioStore } from './store'
import { buildSeedState } from './seed-state'
import { seedEntities, seedClaims } from './seed-data'
import { snapshotCorpus } from './history-snapshot'
import type { StudioState } from './store-types'
import type { Entity, Claim } from './types'

const ENTITY_TEMPLATE: Entity = {
  ...structuredClone(seedEntities[0]),
  description: '',
  content: '',
  tags: [],
  links: [],
}
const CLAIM_TEMPLATE: Claim = {
  ...structuredClone(seedClaims[0]),
  statement: '',
}

/** Reset the store to fresh canonical data and clear every transient control. */
export const resetStore = (overrides: Partial<StudioState> = {}): void => {
  const seed = buildSeedState()
  useStudioStore.setState({
    ...seed,
    selectedEntityId: null,
    editingEntityId: null,
    pendingEntityName: null,
    commandOpen: false,
    shortcutsOpen: false,
    tagQuery: '',
    hasDescriptionOnly: false,
    viewMode: 'grid',
    showAll: false,
    mobileDrawerOpen: false,
    mobilePanelView: 'nav',
    entityHistory: [
      snapshotCorpus(seed.entities, seed.claims, {
        graph: seed.graph,
        mindMap: seed.mindMap,
        links: seed.links,
      }),
    ],
    historyIndex: 0,
    ...overrides,
  })
}

/** Build an independent entity fixture from the canonical application seed. */
export const makeEntity = (overrides: Partial<Entity> = {}): Entity => {
  const timestamp = overrides.createdAt ?? overrides.updatedAt ?? new Date().toISOString()
  return {
    ...structuredClone(ENTITY_TEMPLATE),
    id: overrides.id ?? crypto.randomUUID(),
    name: 'Test Entity',
    type: 'note',
    description: 'A test entity',
    content: '# Hello',
    tags: ['test'],
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    links: [],
    ...overrides,
  }
}

/** Build an independent claim fixture from the canonical application seed. */
export const makeClaim = (overrides: Partial<Claim> = {}): Claim => ({
  ...structuredClone(CLAIM_TEMPLATE),
  id: overrides.id ?? crypto.randomUUID(),
  entityId: 'e-1',
  statement: 'Test claim',
  confidence: 0.8,
  verification: 'unverified',
  ...overrides,
})

