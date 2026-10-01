'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        // ✅ Dynamic — current origin use karega (localhost ya vercel)
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
    toast.success('Reset link sent! Check your email');
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🔐</div>
        <h1>Forgot Password</h1>
        <p>
          {sent
            ? 'Check your email for the reset link'
            : 'Enter your email to receive a reset link'}
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                autoFocus
              />
            </div>

            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="notice notice-info" style={{ marginTop: 16 }}>
            ✅ Reset link has been sent to <b>{email}</b>
            <br />
            <br />
            Didn&apos;t receive it? Check spam folder or{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              style={{
                background: 'none',
                color: 'var(--teal-600)',
                fontWeight: 700,
                textDecoration: 'underline',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              try again
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link
            href="/login"
            style={{
              color: 'var(--teal-600)',
              fontSize: 13,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}