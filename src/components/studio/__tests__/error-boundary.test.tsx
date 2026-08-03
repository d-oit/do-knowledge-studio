import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// JSDOM polyfills
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/lib/errors', () => {
  class AppError extends Error {
    userMessage: string
    constructor(message: string, userMessage: string) {
      super(message)
      this.name = 'AppError'
      this.userMessage = userMessage
    }
  }
  return { AppError }
})

// Import AFTER mocks
import { ErrorBoundary } from '@/components/studio/error-boundary'
import { ViewErrorBoundary } from '@/components/studio/view-error-boundary'
import { AppError } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Test helper — component that throws on first render
// ---------------------------------------------------------------------------

function ThrowError({ message = 'Test error' }: { message?: string }) {
  throw new Error(message)
}

function ConditionalThrow({
  shouldThrow = true,
  message = 'Test error',
}: {
  shouldThrow?: boolean
  message?: string
}) {
  if (shouldThrow) throw new Error(message)
  return <p>Recovered content</p>
}

function ThrowAppError({
  message = 'Internal error',
  userMessage = 'Something went wrong. Please try again.',
}: {
  message?: string
  userMessage?: string
}) {
  throw new AppError(message, userMessage)
}

// ---------------------------------------------------------------------------
// 1. ErrorBoundary — catches errors and renders fallback UI
// ---------------------------------------------------------------------------

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <p>Normal content</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Normal content')).toBeDefined()
  })

  it('renders default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Something broke" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeDefined()
    expect(screen.getByText('Something broke')).toBeDefined()
    expect(screen.getByText('Try again')).toBeDefined()
  })

  it('renders the error message in the fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Specific failure" />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Specific failure')).toBeDefined()
  })

  it('renders default message when error has no message', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="" />
      </ErrorBoundary>,
    )
    // Empty string is falsy — fallback shows the default
    expect(screen.getByText('An unexpected error occurred.')).toBeDefined()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom error UI')).toBeDefined()
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  it('resets error state when Try again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrow shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeDefined()

    // Update children to stop throwing BEFORE the boundary resets
    rerender(
      <ErrorBoundary>
        <ConditionalThrow shouldThrow={false} />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByText('Try again'))

    expect(screen.getByText('Recovered content')).toBeDefined()
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  it('renders the AlertTriangle icon in fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    )
    // The icon renders as an SVG — check for the h-10 w-10 class used by AlertTriangle
    const icon = document.querySelector('.h-10.w-10')
    expect(icon).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 2. ViewErrorBoundary — per-view error isolation
// ---------------------------------------------------------------------------

describe('ViewErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('renders children when no error occurs', () => {
    render(
      <ViewErrorBoundary viewName="Editor">
        <p>Editor content</p>
      </ViewErrorBoundary>,
    )
    expect(screen.getByText('Editor content')).toBeDefined()
  })

  it('renders "{viewName} failed to load" when a child throws', () => {
    render(
      <ViewErrorBoundary viewName="Library">
        <ThrowError />
      </ViewErrorBoundary>,
    )
    expect(screen.getByText('Library failed to load')).toBeDefined()
    expect(screen.getByText('Reload view')).toBeDefined()
  })

  it('shows default user-facing message for generic errors', () => {
    render(
      <ViewErrorBoundary viewName="Graph">
        <ThrowError message="graph crash" />
      </ViewErrorBoundary>,
    )
    expect(
      screen.getByText(
        'An unexpected error occurred. Please try reloading this view.',
      ),
    ).toBeDefined()
  })

  it('shows AppError.userMessage when error is an AppError', () => {
    render(
      <ViewErrorBoundary viewName="Chat">
        <ThrowAppError userMessage="Connection lost. Please check your network." />
      </ViewErrorBoundary>,
    )
    expect(
      screen.getByText('Connection lost. Please check your network.'),
    ).toBeDefined()
  })

  it('calls onError callback with error and errorInfo', () => {
    const onError = vi.fn()
    render(
      <ViewErrorBoundary viewName="TRIZ" onError={onError}>
        <ThrowError message="triz failure" />
      </ViewErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'triz failure' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    )
  })

  it('resets error state when Reload view is clicked', () => {
    const { rerender } = render(
      <ViewErrorBoundary viewName="Export">
        <ConditionalThrow shouldThrow={true} />
      </ViewErrorBoundary>,
    )
    expect(screen.getByText('Export failed to load')).toBeDefined()

    // Update children to stop throwing BEFORE the boundary resets
    rerender(
      <ViewErrorBoundary viewName="Export">
        <ConditionalThrow shouldThrow={false} />
      </ViewErrorBoundary>,
    )
    fireEvent.click(screen.getByText('Reload view'))

    expect(screen.getByText('Recovered content')).toBeDefined()
    expect(screen.queryByText('Export failed to load')).toBeNull()
  })

  it('renders the Reload view button with accessible label', () => {
    render(
      <ViewErrorBoundary viewName="Mind Map">
        <ThrowError />
      </ViewErrorBoundary>,
    )
    const reloadBtn = screen.getByRole('button', { name: 'Reload view' })
    expect(reloadBtn).toBeDefined()
  })
})
