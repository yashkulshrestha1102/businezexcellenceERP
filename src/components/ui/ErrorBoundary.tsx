'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-loader">
          <div style={{ fontSize: 48 }}>😵</div>
          <h2 style={{ color: 'var(--teal-800)', fontSize: 20 }}>
            Kuch galat ho gaya
          </h2>
          <p style={{ color: 'var(--muted)', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            className="btn btn-sm"
            style={{ width: 'auto', marginTop: 12 }}
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}