'use client'

import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

/** Animated skeleton placeholder for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton', className)}
      aria-hidden="true"
      role="presentation"
    />
  )
}

/** Skeleton placeholder shaped like an entity card with avatar and text lines. */
export function EntityCardSkeleton({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        className,
      )}
      aria-hidden="true"
      role="presentation"
    >
      <div className="flex items-start gap-3">
        <Skeleton
          className={cn(
            'h-10 w-10 shrink-0 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton
            className={cn(
              'h-4 w-3/4',
              reducedMotion && 'animate-none',
            )}
          />
          <Skeleton
            className={cn(
              'h-3 w-full',
              reducedMotion && 'animate-none',
            )}
          />
          <Skeleton
            className={cn(
              'h-3 w-2/3',
              reducedMotion && 'animate-none',
            )}
          />
        </div>
      </div>
    </div>
  )
}

/** Stack of skeleton list items for loading list views. */
export function ListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      className={cn('space-y-3', className)}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Skeleton
            className={cn(
              'h-4 w-4 shrink-0 rounded',
              reducedMotion && 'animate-none',
            )}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton
              className={cn(
                'h-3.5 w-1/3',
                reducedMotion && 'animate-none',
              )}
            />
            <Skeleton
              className={cn(
                'h-2.5 w-1/2',
                reducedMotion && 'animate-none',
              )}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Skeleton placeholder that mimics a knowledge graph node layout. */
export function GraphSkeleton({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      className={cn(
        'flex h-full items-center justify-center',
        className,
      )}
      aria-hidden="true"
      role="presentation"
    >
      <div className="relative flex items-center justify-center">
        <Skeleton
          className={cn(
            'h-16 w-16 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
        <Skeleton
          className={cn(
            'absolute -left-12 top-1/2 h-1 w-10 -translate-y-1/2 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
        <Skeleton
          className={cn(
            'absolute -right-12 top-1/2 h-1 w-10 -translate-y-1/2 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
        <Skeleton
          className={cn(
            'absolute left-1/2 -top-10 h-10 w-1 -translate-x-1/2 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
        <Skeleton
          className={cn(
            'absolute left-1/2 -bottom-10 h-10 w-1 -translate-x-1/2 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
        <Skeleton
          className={cn(
            'absolute -left-16 -top-6 h-8 w-8 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
        <Skeleton
          className={cn(
            'absolute -right-16 -bottom-6 h-8 w-8 rounded-full',
            reducedMotion && 'animate-none',
          )}
        />
      </div>
    </div>
  )
}

/** Skeleton placeholder that mimics a chat message thread. */
export function ChatSkeleton({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      className={cn('space-y-4 p-4', className)}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: 4 }, (_, i) => {
        const isUser = i % 2 === 1
        return (
          <div
            key={i}
            className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'space-y-1.5 rounded-xl px-4 py-3',
                isUser ? 'bg-saffron-soft' : 'bg-muted',
                'w-3/4',
              )}
            >
              <Skeleton
                className={cn(
                  'h-3 w-full',
                  reducedMotion && 'animate-none',
                )}
              />
              <Skeleton
                className={cn(
                  'h-3 w-4/5',
                  reducedMotion && 'animate-none',
                )}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
