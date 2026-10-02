import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHardReset = () => {
    try {
      localStorage.removeItem('microteach_user');
      localStorage.removeItem('microteach_applied_post_ids');
    } catch (_) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '480px',
            background: '#ffffff',
            padding: '32px 28px',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '24px'
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
              Oops! Something went wrong
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: '1.5' }}>
              We encountered an unexpected display issue. Don't worry, your data is safe.
            </p>
            {this.state.error && (
              <pre style={{
                background: '#f1f5f9',
                color: '#475569',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px'
              }}>
                {typeof this.state.error?.message === 'string'
                  ? this.state.error.message
                  : typeof this.state.error === 'string'
                    ? this.state.error
                    : JSON.stringify(this.state.error, null, 2)}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleHardReset}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--color-primary, #df2935)',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Clear Cache &amp; Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
