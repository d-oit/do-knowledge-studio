import { forwardRef, useEffect, useRef, useCallback } from 'react'
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
    'min-h-[44px] min-w-[44px] rounded-md bg-primary text-primary-foreground shadow-sm hover:opacity-90 press-scale',
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
        'flex min-h-[44px] items-center gap-1 rounded-md px-2 py-1.5 text-label font-medium transition-colors focus-ring',
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

// ---------------------------------------------------------------------------
// SwitchToggle — accessible toggle switch for settings panels
// ---------------------------------------------------------------------------

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
        className={cn(
          'relative h-5 w-9 overflow-hidden rounded-full transition-colors',
          checked ? 'bg-saffron' : 'bg-border',
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlay (Dialog)
// ---------------------------------------------------------------------------

interface OverlayProps {
  open: boolean
  onClose: () => void
  /** Accessible label for the dialog */
  'aria-label'?: string
  /** ID of the element that labels the dialog */
  'aria-labelledby'?: string
  /** Whether clicking the backdrop closes the dialog */
  closeOnBackdrop?: boolean
  /** Whether pressing Escape closes the dialog */
  closeOnEscape?: boolean
  /** Whether to trap focus within the dialog */
  trapFocus?: boolean
  className?: string
  children: React.ReactNode
}

export function Overlay({
  open,
  onClose,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
  trapFocus = true,
  className,
  children,
}: OverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Save and restore focus
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // Focus the container or first focusable element
      const container = containerRef.current
      if (container) {
        const firstFocusable = container.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        ;(firstFocusable ?? container).focus()
      }
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [open])

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }

      // Focus trap
      if (trapFocus && e.key === 'Tab' && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [closeOnEscape, onClose, trapFocus],
  )

  // Backdrop click handler
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose()
      }
    },
    [closeOnBackdrop, onClose],
  )

  if (!open) return null

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className={cn(
        'fixed inset-0 z-[800] flex items-center justify-center bg-ink/30 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}
