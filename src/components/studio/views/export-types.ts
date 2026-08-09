import type { Entity, Claim } from '@/lib/studio/types'
import {
  FileText,
  FileJson,
  FileCode,
  FileArchive,
  FileLock,
} from 'lucide-react'
import { type ValidationError, type ValidatedGraph, type ValidatedMindMap, type ValidatedLink, type ValidatedTag } from '@/lib/studio/schema'

/** Supported export output formats. */
export type ExportFormatId = 'json' | 'markdown' | 'html' | 'pdf' | 'docx' | 'encrypted' | 'okf'

/** Result of parsing an import file: either validated data or a list of errors. */
export type ImportResult =
  | { success: true; entities: Entity[]; claims: Claim[]; graph?: ValidatedGraph; mindMap?: ValidatedMindMap; links?: ValidatedLink[]; tags?: ValidatedTag[] }
  | { success: false; errors: ValidationError[] }

/** Preview of an import shown to the user before confirmation. */
export interface ImportPreview {
  /** Entities to serialize. */
  entities: Entity[]
  /** The library claims being processed. */
  claims: Claim[]
  /** Optional graph payload carried through the operation. */
  graph?: ValidatedGraph
  /** Optional mind map payload carried through the operation. */
  mindMap?: ValidatedMindMap
  /** Related entity links. */
  links?: ValidatedLink[]
  /** Optional tags payload carried through the operation. */
  tags?: ValidatedTag[]
  /** Number of entities in the payload. */
  entityCount: number
  /** Number of claims in the payload. */
  claimCount: number
  /** Claim schema version. */
  version: number
  /** Entity ids that already exist in the library. */
  duplicateIds: string[]
}

/** Theme color keys used by export format cards. */
export type ExportColorKey = 'saffron' | 'sky' | 'sage' | 'clay'

/** Display metadata for a single export format option. */
export interface ExportFormat {
  /** Unique identifier. */
  id: ExportFormatId
  /** Human-readable name. */
  name: string
  /** One-line summary of the item. */
  description: string
  /** Icon component used for the format card. */
  icon: typeof FileText
  /** Theme color key for the format card. */
  color: ExportColorKey
  /** Optional badge label shown on the format card. */
  badge?: string
  /** Whether the format is currently available. */
  available?: boolean
}

/** All export formats offered in the export view, in display order. */
export const FORMATS: ExportFormat[] = [
  {
    /** Unique identifier. */
    id: 'markdown',
    /** Human-readable name. */
    name: 'Markdown',
    /** One-line summary of the item. */
    description: 'Single .md file with every entity (and its claims) separated by ---.',
    /** Icon component used for the format card. */
    icon: FileText,
    /** Theme color key for the format card. */
    color: 'saffron',
    /** Whether the format is currently available. */
    available: true,
  },
  {
    /** Unique identifier. */
    id: 'okf',
    /** Human-readable name. */
    name: 'OKF Bundle',
    /** One-line summary of the item. */
    description:
      'Open Knowledge Format v0.2 — agent-readable Markdown bundle with provenance, trust & lifecycle frontmatter',
    /** Icon component used for the format card. */
    icon: FileText,
    /** Theme color key for the format card. */
    color: 'sky',
    /** Whether the format is currently available. */
    available: true,
  },
  {
    /** Unique identifier. */
    id: 'json',
    /** Human-readable name. */
    name: 'JSON',
    /** One-line summary of the item. */
    description: 'Single .json file with all entities, claims, and links. Best for backup.',
    /** Icon component used for the format card. */
    icon: FileJson,
    /** Theme color key for the format card. */
    color: 'sky',
    /** Whether the format is currently available. */
    available: true,
  },
  {
    /** Unique identifier. */
    id: 'html',
    /** Human-readable name. */
    name: 'Static HTML',
    /** One-line summary of the item. */
    description: 'Single self-contained .html page that renders all entities. Open in any browser.',
    /** Icon component used for the format card. */
    icon: FileCode,
    /** Theme color key for the format card. */
    color: 'sage',
    /** Whether the format is currently available. */
    available: true,
  },
  {
    /** Unique identifier. */
    id: 'pdf',
    /** Human-readable name. */
    name: 'PDF document',
    /** One-line summary of the item. */
    description: 'Formatted PDF with all entities, claims, and metadata. Print-ready.',
    /** Icon component used for the format card. */
    icon: FileArchive,
    /** Theme color key for the format card. */
    color: 'clay',
    /** Whether the format is currently available. */
    available: true,
  },
  {
    /** Unique identifier. */
    id: 'docx',
    /** Human-readable name. */
    name: 'DOCX document',
    /** One-line summary of the item. */
    description: 'Word document with structured entities, claims, and hyperlinks.',
    /** Icon component used for the format card. */
    icon: FileText,
    /** Theme color key for the format card. */
    color: 'saffron',
    /** Whether the format is currently available. */
    available: true,
  },
  {
    /** Unique identifier. */
    id: 'encrypted',
    /** Human-readable name. */
    name: 'Encrypted HTML',
    /** One-line summary of the item. */
    description: 'Self-contained reader protected by a password. Safe to share privately.',
    /** Icon component used for the format card. */
    icon: FileLock,
    /** Theme color key for the format card. */
    color: 'clay',
    /** Optional badge label shown on the format card. */
    badge: 'Secure',
    /** Whether the format is currently available. */
    available: true,
  },
]

/** Tailwind color classes for each export format color key. */
export const COLOR_MAP: Record<ExportColorKey, string> = {
  saffron: 'bg-saffron-soft text-saffron-deep',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  sage: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  clay: 'bg-rose-100 text-clay dark:bg-rose-950/40 dark:text-rose-300',
}

/** Returns today's date formatted as YYYY-MM-DD for export filenames. */
export const todayStamp = (): string => {
  /** The date. */
  const date = new Date()
  /** The year. */
  const year = date.getFullYear()
  /** The month. */
  const month = String(date.getMonth() + 1).padStart(2, '0')
  /** The day. */
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Triggers a browser download for the given blob. */
export const downloadBlob = (filename: string, blob: Blob) => {
  /** The url. */
  const url = URL.createObjectURL(blob)
  /** The anchor. */
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Triggers a browser download for the given text content. */
export const downloadFile = (filename: string, content: string, mimeType = 'text/plain') => {
  /** The blob. */
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(filename, blob)
}

/** Groups claims by their owning entity id. */
export const buildClaimsByEntityId = (claims: Claim[]): Map<string, Claim[]> => {
  /** The map. */
  const map = new Map<string, Claim[]>()
  for (const c of claims) {
    /** The list. */
    const list = map.get(c.entityId)
    if (list) {
      list.push(c)
    } else {
      map.set(c.entityId, [c])
    }
  }
  return map
}

/** Optional export payload sections beyond entities and claims. */
export interface ExportOptions {
  /** Optional graph payload carried through the operation. */
  graph?: ValidatedGraph
  /** Optional mind map payload carried through the operation. */
  mindMap?: ValidatedMindMap
  /** Related entity links. */
  links?: ValidatedLink[]
  /** Optional tags payload carried through the operation. */
  tags?: ValidatedTag[]
}