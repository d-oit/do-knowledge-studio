'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-clay" />
            <h2 className="mb-1 font-serif text-lg font-semibold text-ink">
              Something went wrong
            </h2>
            <p className="mb-4 max-w-sm text-[13px] text-ink-mute">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }) }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
