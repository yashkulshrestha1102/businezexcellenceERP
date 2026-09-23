import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="login-screen">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: 32, color: 'var(--teal-800)' }}>404</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
          Ye page exist nahi karta
        </p>
        <Link
          href="/dashboard"
          className="btn"
          style={{ display: 'inline-block', textDecoration: 'none' }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}