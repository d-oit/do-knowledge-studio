export type EntityType = 'note' | 'concept' | 'person' | 'project'

export type VerificationStatus = 'unverified' | 'verified' | 'disputed'

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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: { entityId: string; entityName: string; snippet: string }[]
  timestamp: string
}

export interface GraphNode {
  id: string
  label: string
  type: EntityType
  x: number
  y: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relation: string
}

export const ENTITY_TYPE_META: Record<
  EntityType,
  { label: string; color: string; bg: string; text: string; dot: string; icon: string }
> = {
  note: {
    label: 'Note',
    color: 'sky',
    bg: 'bg-sky-100 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
    icon: 'FileText',
  },
  concept: {
    label: 'Concept',
    color: 'saffron',
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-600',
    icon: 'Lightbulb',
  },
  person: {
    label: 'Person',
    color: 'clay',
    bg: 'bg-rose-100 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    icon: 'User',
  },
  project: {
    label: 'Project',
    color: 'sage',
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-600',
    icon: 'FolderKanban',
  },
}
