import { FileText, FolderKanban, Lightbulb, Shapes, User } from 'lucide-react'
import { memo } from 'react'
import type { AnyEntityType } from '@/lib/studio/types'
import { getEntityTypeMeta } from '@/lib/studio/entity-types'

/**
 * Icon component for an entity type, rendered with the given classes.
 * Built-in types keep an explicit switch (single source of truth for the
 * type→icon mapping); registered custom types resolve through the registry
 * and unknown types fall back to a neutral icon. Never throws.
 */
export const EntityIcon = memo(({ type, className }: { type: AnyEntityType; className?: string }) => {
  switch (type) {
    case 'note':
      return <FileText className={className} />
    case 'concept':
      return <Lightbulb className={className} />
    case 'person':
      return <User className={className} />
    case 'project':
      return <FolderKanban className={className} />
    default: {
      const Icon = getEntityTypeMeta(type).icon ?? Shapes
      return <Icon className={className} />
    }
  }
})

EntityIcon.displayName = 'EntityIcon'