'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="login-screen">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>😵</div>
        <h1 style={{ fontSize: 24, color: 'var(--teal-800)', marginBottom: 12 }}>
          Kuch galat ho gaya
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 13.5 }}>
          {error.message || 'Unexpected error aaya hai'}
        </p>
        <button
          className="btn"
          onClick={reset}
          style={{ marginBottom: 10 }}
        >
          🔄 Try Again
        </button>
      </div>
    </div>
  );
}