import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
export { Overlay } from './overlay'

/**
 * Minimum hit area for an interactive control (44x44px, from the
 * `--spacing-touch` token). WCAG 2.5.5 / AGENTS.md touch-target floor — apply
 * to icon-only buttons rather than re-declaring the raw `44px` size.
 */
export const TOUCH_TARGET_CLASS = 'min-h-touch min-w-touch' as const

// ---------------------------------------------------------------------------
// TextInput
// ---------------------------------------------------------------------------

/** Styled text input with optional monospace font and ref forwarding. */
export const TextInput = forwardRef<
  HTMLInputElement,
  {
    className?: string
    mono?: boolean
  } & React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className, mono, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-2 text-body-sm text-ink',
        'placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30',
        mono && 'font-mono',
        className,
      )}
      {...props}
    />
  )
})

// ---------------------------------------------------------------------------
// Divider (toolbar)
// ---------------------------------------------------------------------------

/** Vertical divider line for toolbar grouping. */
export function Divider({ className }: { className?: string }) {
  return <span className={cn('mx-1 h-4 w-px bg-border', className)} aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// ToggleButtonGroup (container)
// ---------------------------------------------------------------------------

/** Grouped toggle buttons rendered as an ARIA group container. */
export function ToggleButtonGroup({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center gap-1 rounded-md border border-border p-0.5', className)}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton (existing)
// ---------------------------------------------------------------------------

/** Generic animated skeleton placeholder for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton', className)}
      aria-hidden="true"
      role="presentation"
    />
  )
}

// ---------------------------------------------------------------------------
// SwitchToggle — accessible toggle switch for settings panels
// ---------------------------------------------------------------------------

/** Accessible toggle switch with label, description, and icon for settings panels. */
export function SwitchToggle({
  label,
  description,
  icon: Icon,
  checked,
  onToggle,
}: {
  label: string
  description: string
  icon: LucideIcon
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-saffron" />
        <div>
          <div className="text-label-lg font-medium text-ink">{label}</div>
          <div className="text-caption text-ink-faint">{description}</div>
        </div>
      </div>
      <button
        onClick={onToggle}
        className="relative flex min-h-touch min-w-touch items-center justify-center rounded-md"
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={cn(
            'relative h-5 w-9 overflow-hidden rounded-full transition-colors',
            checked ? 'bg-saffron' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              checked ? 'translate-x-[18px]' : 'translate-x-0',
            )}
          />
        </span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View chrome — container, hero header, empty state (#870)
// ---------------------------------------------------------------------------

/**
 * Canonical horizontal gutter for a view body.
 *
 * Chrome rows that must line up with the body use this too: the chat composer
 * and suggestions bar sit below a scroll region padded with it, and the editor
 * toolbar bleeds into it with negative margins. Keeping one export means the
 * alignment can never drift apart.
 */
export const VIEW_GUTTER_CLASS = 'px-6 lg:px-10'

/**
 * Container for a view body: centered, with the shared gutter and vertical
 * rhythm.
 *
 * Views append their own width cap, e.g.
 * `cn(VIEW_CONTAINER_CLASS, 'max-w-5xl')`. Views whose body is a canvas or a
 * scroll region instead of a centered column pass it as-is.
 */
export const VIEW_CONTAINER_CLASS = cn('mx-auto py-6 lg:py-8', VIEW_GUTTER_CLASS)

/** Props for {@link ViewHeader}. */
interface ViewHeaderProps {
  /** Lucide icon rendered in the tinted tile beside the title. */
  icon: LucideIcon
  /** View identity. Rendered as `h2` — the shell topbar owns the only `h1`. */
  title: string
  /** Optional one-line description under the title. */
  subtitle?: string
  /** Optional chip rendered beside the title (e.g. a "Lab" marker). */
  badge?: React.ReactNode
  /** Optional trailing control aligned with the title row. */
  action?: React.ReactNode
  /** Extra classes, typically a margin override when the caller wraps this in an animated element. */
  className?: string
}

/**
 * In-view hero header, shared by every view (DESIGN-SYSTEM.md §11).
 *
 * The hero treatment used to exist in four views with three different layouts;
 * this is the one implementation. Pass already-translated strings — the
 * primitive never hardcodes copy.
 */
export function ViewHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  action,
  className,
}: ViewHeaderProps) {
  return (
    <header className={cn('mb-6 flex items-start gap-4', className)}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-saffron to-clay text-white shadow-sm">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>
          {badge}
        </div>
        {subtitle ? <p className="mt-1 text-body-sm text-ink-mute">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  )
}

/** Props for {@link ViewEmptyState}. */
interface ViewEmptyStateProps {
  /** Lucide icon shown in the tinted circle above the headline. */
  icon: LucideIcon
  /** Headline naming what is missing. */
  title: string
  /** One or two lines explaining how to fill the view. */
  body: string
  /** Primary action that leaves the dead end. */
  actionLabel: string
  /** Runs when the primary action is activated. */
  onAction: () => void
  /** Optional icon for the primary action button. */
  actionIcon?: LucideIcon
  /** Extra classes, e.g. a width cap or a frame tuned for a canvas overlay. */
  className?: string
}

/**
 * Empty state for a whole view — the single dead-end frame (DESIGN-SYSTEM.md
 * §8.9 empty states).
 *
 * Extracted from the library view's empty state so a view can never render a
 * dead end: every usage passes a real action, typically the store's
 * `startNew`, and therefore always offers the way into the editor.
 */
export function ViewEmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className,
}: ViewEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-saffron-soft">
        <Icon aria-hidden="true" className="h-6 w-6 text-saffron" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-body-sm text-ink-mute">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 flex min-h-touch items-center gap-1.5 rounded-md bg-primary px-4 text-body-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
      >
        {ActionIcon ? <ActionIcon aria-hidden="true" className="h-4 w-4" /> : null}
        {actionLabel}
      </button>
    </div>
  )
}
