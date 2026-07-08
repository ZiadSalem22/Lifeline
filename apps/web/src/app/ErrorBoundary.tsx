import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Root error boundary: simple fallback card with a reload button. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="alert"
            style={{
              maxWidth: 420,
              padding: 28,
              borderRadius: 16,
              border: '1px solid var(--color-border, #333)',
              background: 'var(--color-surface, #0d0d0d)',
              color: 'var(--color-text, #fff)',
              textAlign: 'center',
            }}
          >
            <h1 style={{ fontSize: '1.25rem', marginBottom: 12 }}>Something went wrong</h1>
            <p style={{ color: 'var(--color-text-muted, #999)', marginBottom: 20 }}>
              An unexpected error occurred. Reloading usually fixes it.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-primary, #0f4)',
                color: 'var(--color-bg, #000)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
