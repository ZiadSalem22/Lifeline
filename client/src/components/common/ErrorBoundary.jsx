import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // Could log to an external service here
    console.error('ErrorBoundary caught error:', error, info);
  }
  handleReload = () => {
    if (this.props.onReset) this.props.onReset();
    this.setState({ hasError: false, error: null });
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '1rem', background: 'var(--color-bg-alt,#220015)', color: 'var(--color-text,#fff)', fontFamily: 'var(--font-family-base)', minHeight: '100vh' }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong.</h2>
          {this.state.error && <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{String(this.state.error.message || this.state.error)}</pre>}
          <button onClick={this.handleReload} style={{ padding: '0.5rem 1rem', background: '#6C63FF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
