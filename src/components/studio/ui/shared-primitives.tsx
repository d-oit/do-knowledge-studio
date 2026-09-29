import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
export { Overlay } from './overlay'

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
        'w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-ink',
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
          <div className="text-[12px] font-medium text-ink">{label}</div>
          <div className="text-caption text-ink-faint">{description}</div>
        </div>
      </div>
      <button
        onClick={onToggle}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
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
