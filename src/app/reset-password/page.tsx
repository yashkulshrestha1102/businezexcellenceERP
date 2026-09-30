'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user has a valid reset session
    const checkSession = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Invalid or expired reset link');
        setTimeout(() => router.push('/forgot-password'), 2000);
        setChecking(false);
        return;
      }

      setValidSession(true);
      setChecking(false);
    };

    checkSession();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!password || !confirm) {
      toast.error('Please fill both fields');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success('Password updated! Please login');
    setTimeout(() => router.push('/login'), 1500);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-logo">🔐</div>
          <h1>Verifying...</h1>
          <p>Please wait while we verify your reset link</p>
        </div>
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, color: 'var(--teal-800)' }}>
            Invalid Reset Link
          </h1>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
            This link is invalid or has expired
          </p>
          <Link
            href="/forgot-password"
            className="btn"
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🔐</div>
        <h1>Reset Password</h1>
        <p>Enter your new password</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="field">
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

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