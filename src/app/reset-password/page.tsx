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
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const checkReset = async () => {
      const supabase = createClient();

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      // === 1. URL error params ===
      const error =
        searchParams.get('error') ||
        hashParams.get('error') ||
        searchParams.get('error_code') ||
        hashParams.get('error_code');

      const errorDescription =
        searchParams.get('error_description') ||
        hashParams.get('error_description');

      if (error) {
        setErrorMsg(
          errorDescription?.replace(/\+/g, ' ') ||
            'Reset link is invalid or has expired'
        );
        setChecking(false);
        return;
      }

      // === 2. token_hash in URL (Supabase v2 format) ===
      const tokenHash =
        searchParams.get('token_hash') || hashParams.get('token_hash');
      const type = searchParams.get('type') || hashParams.get('type');

      if (tokenHash && type === 'recovery') {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (otpError) {
          setErrorMsg(
            'Reset link is invalid or has expired. Please request a new one.'
          );
          setChecking(false);
          return;
        }
        setValid(true);
        setChecking(false);
        return;
      }

      // === 3. PKCE code in URL ===
      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (!exchangeError) {
          setValid(true);
          setChecking(false);
          return;
        }

        // Fallback: try as token_hash
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: code,
          type: 'recovery',
        });
        if (!otpError) {
          setValid(true);
          setChecking(false);
          return;
        }

        setErrorMsg(
          'Reset link is invalid or has expired. Please request a new one.'
        );
        setChecking(false);
        return;
      }

      // === 4. Legacy #access_token=... ===
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashType = hashParams.get('type');

      if (accessToken && refreshToken && hashType === 'recovery') {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!sessionError) {
          setValid(true);
          setChecking(false);
          return;
        }
        setErrorMsg(sessionError.message);
        setChecking(false);
        return;
      }

      // === 5. Existing session ===
      await new Promise((r) => setTimeout(r, 500));
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setValid(true);
        setChecking(false);
        return;
      }

      setErrorMsg(
        'Reset link is invalid or has expired. Please request a new one.'
      );
      setChecking(false);
    };

    checkReset();
  }, []);

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

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success('Password updated! Please login');
    await supabase.auth.signOut();
    setTimeout(() => router.push('/login'), 1200);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-logo">🔐</div>
          <h1>Verifying Link</h1>
          <p style={{ color: 'var(--muted)' }}>
            Please wait while we verify your reset link
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !valid) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, color: 'var(--teal-800)', marginBottom: 12 }}>
            Invalid Reset Link
          </h1>
          <p
            style={{
              color: 'var(--muted)',
              marginBottom: 20,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {errorMsg || 'This link is invalid or has expired'}
          </p>
          <Link
            href="/forgot-password"
            className="btn"
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            Request New Link
          </Link>
          <div style={{ marginTop: 16 }}>
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