import { FileText, FolderKanban, Lightbulb, Shapes, User, type LucideIcon } from 'lucide-react'
import { memo } from 'react'
import type { AnyEntityType } from '@/lib/studio/types'
import { getEntityTypeMeta } from '@/lib/studio/entity-types'

/**
 * Icon component for an entity type, rendered with the given classes.
 * Built-in types map through a bounded lookup (single source of truth for
 * the type→icon mapping); registered custom types resolve through the
 * registry and unknown types fall back to a neutral icon. Never throws.
 */
const BUILTIN_ICONS: ReadonlyMap<AnyEntityType, LucideIcon> = new Map([
  ['note', FileText],
  ['concept', Lightbulb],
  ['person', User],
  ['project', FolderKanban],
])

export const EntityIcon = memo(({ type, className }: { type: AnyEntityType; className?: string }) => {
  const Icon = BUILTIN_ICONS.get(type) ?? getEntityTypeMeta(type).icon ?? Shapes
  return <Icon className={className} />
})

EntityIcon.displayName = 'EntityIcon'