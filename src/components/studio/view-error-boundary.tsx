'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { AppError } from '@/lib/errors'

interface ViewErrorBoundaryProps {
  viewName: string
  children: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ViewErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/** Converts an error into a user-friendly message, using AppError.userMessage when available. */
function userFacingMessage(error: Error | null): string {
  if (error instanceof AppError) return error.userMessage
  return 'An unexpected error occurred. Please try reloading this view.'
}

/** Error boundary that catches render errors in a view and shows a reload fallback. */
export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-clay" />
            <h2 className="mb-1 font-serif text-lg font-semibold text-ink">
              {this.props.viewName} failed to load
            </h2>
            <p className="mb-4 max-w-sm text-body-sm text-ink-mute">
              {userFacingMessage(this.state.error)}
            </p>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reload view
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
