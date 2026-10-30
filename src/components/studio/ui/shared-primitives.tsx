import { forwardRef, useId } from 'react'
import { HelpCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { translate as confirmT } from '@/lib/i18n/messages/confirm'
import { Overlay } from './overlay'

export { Overlay }

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
// Toolbar button
// ---------------------------------------------------------------------------

interface ToolbarBtnProps {
  icon: LucideIcon
  label: string
  /** Contextual help shown on hover. */
  help?: string
  active?: boolean
  ariaExpanded?: boolean
  ariaControls?: string
  onClick?: () => void
  disabled?: boolean
  title?: string
  disabledTitle?: string
  labelClassName?: string
}

/** Accessible icon button shared by the graph and mind-map toolbars. */
export const ToolbarBtn = ({
  icon: Icon,
  label,
  help,
  active,
  ariaExpanded,
  ariaControls,
  onClick,
  disabled,
  title = label,
  disabledTitle,
  labelClassName = 'hidden sm:inline',
}: ToolbarBtnProps) => {
  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledTitle ?? title : title}
      aria-label={label}
      aria-pressed={ariaExpanded !== undefined ? undefined : active}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={cn(
        'flex min-h-touch min-w-touch items-center gap-1 rounded-md px-2 py-1.5 text-label font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-saffron-soft text-saffron-deep' : 'text-ink-mute hover:bg-muted hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className={labelClassName}>{label}</span>
    </button>
  )

  if (!help) return button

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-52 text-center">
          <span className="flex items-center justify-center gap-1">
            <HelpCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {help}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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
  const labelId = useId()
  const descriptionId = useId()

  return (
    <div
      onClick={onToggle}
      className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-saffron" aria-hidden="true" />
        <div>
          <div id={labelId} className="text-label-lg font-medium text-ink">
            {label}
          </div>
          <div id={descriptionId} className="text-caption text-ink-faint">
            {description}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="relative flex min-h-touch min-w-touch items-center justify-center rounded-md focus-ring"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
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
  body?: string
  /** Optional CTA label; omit to render an informational empty state. */
  actionLabel?: string
  /** Runs when the optional CTA is activated. */
  onAction?: () => void
  /** Optional icon for the CTA button. */
  actionIcon?: LucideIcon
  /** Extra classes, e.g. a width cap or a frame tuned for a canvas overlay. */
  className?: string
}

/**
 * Empty state for a whole view — the single dead-end frame (DESIGN-SYSTEM.md
 * §8.9 empty states).
 *
 * Callers with a way out pass an action; informational and search-specific
 * states may omit it while retaining their own copy and context.
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
      {body ? <p className="mx-auto mt-1 max-w-sm text-body-sm text-ink-mute">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 flex min-h-touch items-center gap-1.5 rounded-md bg-primary px-4 text-body-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
        >
          {ActionIcon ? <ActionIcon aria-hidden="true" className="h-4 w-4" /> : null}
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
// ConfirmDialog — shared confirmation for destructive actions (#863)
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  /** Whether the dialog is shown; nothing renders while false. */
  open: boolean
  /** Runs the confirmed action. */
  onConfirm: () => void
  /** Dismisses the dialog (Cancel button, Escape, or backdrop click). */
  onCancel: () => void
  /** Dialog heading; doubles as the dialog's accessible name. */
  title: string
  /** Explanatory copy under the heading. */
  body: string
  /** Label of the confirming action. */
  confirmLabel: string
  /** Label of the dismissing action; defaults to the shared Cancel copy. */
  cancelLabel?: string
  /** Marks the confirming action as destructive (red styling). */
  destructive?: boolean
}

/**
 * Confirmation dialog for irreversible actions, e.g. clearing a chat or
 * discarding a draft (#863). Built on {@link Overlay}, so Escape and backdrop
 * clicks cancel, focus moves into the dialog on open (the Cancel button, which
 * is the first focusable element — the safe default for a destructive action)
 * and returns to the trigger on close. All copy arrives already translated.
 *
 * Its accessible name is the visible heading and its accessible *description* is
 * the body: with `aria-label` alone a screen reader announced the question and
 * never the warning the user is confirming (review on #939). The ids come from
 * `useId`, so two dialogs mounted at once cannot collide.
 */
export const ConfirmDialog = ({
  open,
  onConfirm,
  onCancel,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
}: ConfirmDialogProps) => {
  const titleId = useId()
  const bodyId = useId()
  return (
  <Overlay
    open={open}
    onClose={onCancel}
    aria-labelledby={titleId}
    aria-describedby={bodyId}
  >
    <div className="w-[360px] max-w-[92vw] rounded-xl border border-border bg-popover p-5 shadow-2xl">
      <h3 id={titleId} className="mb-2 font-serif text-body font-semibold text-ink">{title}</h3>
      <p id={bodyId} className="mb-4 text-label-lg leading-relaxed text-ink-mute">{body}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-label-lg font-medium text-ink-soft transition-colors hover:bg-muted focus-ring min-h-touch"
        >
          {cancelLabel ?? confirmT('confirm.cancel')}
        </button>
        <button
          onClick={onConfirm}
          className={
            destructive
              ? 'rounded-md bg-red-600 px-4 py-1.5 text-label-lg font-semibold text-white transition-colors hover:bg-red-700 focus-ring min-h-touch'
              : 'rounded-md bg-primary px-4 py-1.5 text-label-lg font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring min-h-touch'
          }
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </Overlay>
  )
}
