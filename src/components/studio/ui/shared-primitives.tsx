import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Consistent empty state component for all views. Replaces inline empty-state
 * markup scattered across library, graph, mindmap, editor, and export views.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className,
      )}
      role="status"
    >
      <Icon className="mb-3 h-10 w-10 text-ink-faint/40" aria-hidden="true" />
      <p className="text-[14px] font-medium text-ink-soft">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink-mute">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * Skeleton loading block — wraps the existing `.skeleton` CSS utility.
 * Use `className` to set width/height.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton', className)}
      aria-hidden="true"
      role="presentation"
    />
  )
}
