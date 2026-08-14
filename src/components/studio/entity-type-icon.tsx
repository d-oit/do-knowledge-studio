import { FileText, Lightbulb, User, FolderKanban } from 'lucide-react'
import type { EntityType } from '@/lib/studio/types'

/**
 * Icon component for an entity type, rendered with the given classes.
 * Single source of truth for type→icon mapping (home, library grid/list).
 */
export function EntityIcon({ type, className }: { type: EntityType; className?: string }) {
  switch (type) {
    case 'note':
      return <FileText className={className} />
    case 'concept':
      return <Lightbulb className={className} />
    case 'person':
      return <User className={className} />
    case 'project':
      return <FolderKanban className={className} />
    default:
      // Safe fallback if the EntityType union is extended.
      return <FileText className={className} />
  }
}
