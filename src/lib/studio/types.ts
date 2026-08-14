/** Discriminated union of entity categories. */
export type EntityType = 'note' | 'concept' | 'person' | 'project'

/** Verification lifecycle of a claim. */
export type VerificationStatus = 'unverified' | 'verified' | 'disputed'

/** All navigable view identifiers. */
export type ViewId =
  | 'home'
  | 'editor'
  | 'library'
  | 'graph'
  | 'mindmap'
  | 'chat'
  | 'ai'
  | 'triz'
  | 'export'
  | 'sync'

/** Core knowledge entity representing a note, concept, person, or project. */
export interface Entity {
  id: string
  name: string
  type: EntityType
  description: string
  content: string
  sourceUrl?: string
  tags: string[]
  createdAt: string
  updatedAt: string
  links: { targetId: string; relation: string }[]
}

/** Verifiable assertion linked to an entity. */
export interface Claim {
  id: string
  entityId: string
  statement: string
  evidence?: string
  confidence: number
  verification: VerificationStatus
  source?: string
  createdAt?: string
  updatedAt?: string
  version?: number
  editHistory?: { statement: string; editedAt: string }[]
}

/** Single message in the AI chat conversation. */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: { entityId: string; entityName: string; snippet: string }[]
  timestamp: string
}

/** Visual node in the knowledge graph renderer. */
export interface GraphNode {
  id: string
  label: string
  type: EntityType
  x: number
  y: number
}

/** Directed edge connecting two nodes in the knowledge graph. */
export interface GraphEdge {
  id: string
  source: string
  target: string
  relation: string
}

/** UI metadata (colors, labels) keyed by entity type. */
export const ENTITY_TYPE_META: Record<
  EntityType,
  { label: string; color: string; bg: string; text: string; dot: string }
> = {
  note: {
    label: 'Note',
    color: 'sky',
    bg: 'bg-sky-100 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  concept: {
    label: 'Concept',
    color: 'saffron',
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-600',
  },
  person: {
    label: 'Person',
    color: 'clay',
    bg: 'bg-rose-100 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  project: {
    label: 'Project',
    color: 'sage',
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-600',
  },
}
