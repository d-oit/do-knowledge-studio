import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { logger } from '../lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
  featureName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('ErrorBoundary caught an error:', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      feature: this.props.featureName,
    });
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onRetry?.();
  };

  private copyDetails = async () => {
    if (!this.state.error) return;
    const text = [
      this.props.featureName ? `Feature: ${this.props.featureName}` : null,
      `Error: ${this.state.error.message}`,
      this.state.errorInfo?.componentStack,
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // Clipboard not available; user can still see the message.
    }
  };

  private retryButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  override componentDidUpdate(prevProps: Props, prevState: State): void {
    if (!prevState.hasError && this.state.hasError) {
      // Move focus to the primary recovery action on the next paint.
      requestAnimationFrame(() => {
        this.retryButtonRef.current?.focus();
      });
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      const title = this.props.featureName
        ? `${this.props.featureName} ran into a problem`
        : 'Something went wrong';
      const body =
        this.state.error?.message ||
        'An unexpected error stopped this view from loading.';
      return (
        <div
          className="error-boundary"
          role="alert"
          aria-live="assertive"
        >
          <div className="error-boundary-icon" aria-hidden="true">
            <AlertTriangle size={24} />
          </div>
          <h3 className="error-boundary-title">{title}</h3>
          <p className="error-boundary-body">{body}</p>
          <p className="error-boundary-hint">
            Your work is safe. You can try again, or reload the page if the
            problem keeps happening.
          </p>
          <div className="error-boundary-actions">
            <button
              ref={this.retryButtonRef}
              type="button"
              className="btn-primary"
              onClick={this.handleRetry}
            >
              <RotateCw size={16} aria-hidden="true" />
              Try again
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { void this.copyDetails(); }}
            >
              Copy error details
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
