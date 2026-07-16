import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid' | 'icon-primary'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-all focus-ring disabled:cursor-not-allowed disabled:opacity-40'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary px-4 py-2 text-[12px] text-primary-foreground shadow-sm hover:opacity-90 press-scale',
  secondary:
    'border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft hover:border-saffron/40',
  ghost:
    'border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-muted',
  danger:
    'border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:border-red-300 hover:text-red-600',
  'danger-solid':
    'bg-red-600 px-4 py-1.5 text-[12px] text-white shadow-sm hover:bg-red-700',
  'icon-primary':
    'h-9 w-9 rounded-md bg-primary text-primary-foreground shadow-sm hover:opacity-90 press-scale',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-[11px]',
  md: '',
  lg: 'px-5 py-2.5 text-[13px]',
}

export const Button = forwardRef<
  HTMLButtonElement,
  {
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function Button(
  { variant = 'primary', size = 'md', className, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  )
})

// ---------------------------------------------------------------------------
// FieldLabel
// ---------------------------------------------------------------------------

export function FieldLabel({
  children,
  icon: Icon,
  className,
  htmlFor,
}: {
  children: React.ReactNode
  icon?: LucideIcon
  className?: string
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-1 flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-ink-faint',
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </label>
  )
}

// ---------------------------------------------------------------------------
// TextInput
// ---------------------------------------------------------------------------

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
// SelectInput
// ---------------------------------------------------------------------------

export const SelectInput = forwardRef<
  HTMLSelectElement,
  {
    className?: string
  } & React.SelectHTMLAttributes<HTMLSelectElement>
>(function SelectInput({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] font-medium text-ink-soft',
        'focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30',
        className,
      )}
      {...props}
    />
  )
})

// ---------------------------------------------------------------------------
// Divider (toolbar)
// ---------------------------------------------------------------------------

export function Divider({ className }: { className?: string }) {
  return <span className={cn('mx-1 h-4 w-px bg-border', className)} aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// ToolbarBtn
// ---------------------------------------------------------------------------

export function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-1.5 text-label font-medium transition-colors focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-mute',
        'text-ink-mute hover:bg-muted hover:text-ink',
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// ToggleButtonGroup (container)
// ---------------------------------------------------------------------------

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
// EmptyState (existing)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Skeleton (existing)
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton', className)}
      aria-hidden="true"
      role="presentation"
    />
  )
}
