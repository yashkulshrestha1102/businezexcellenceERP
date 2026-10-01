'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const { loadProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Priority: recovery link detection
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash && hash.includes('type=recovery')) {
      router.replace('/reset-password' + hash);
      return;
    }

    const params = new URLSearchParams(search);
    if (params.get('code') || params.get('token_hash')) {
      router.replace('/reset-password?' + params.toString());
      return;
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email and password required');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      toast.error(error.message || 'Login failed');
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🏢</div>
        <h1>{APP_NAME}</h1>
        <p>{APP_DESCRIPTION}</p>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="your.email@businezexcellence.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link
            href="/forgot-password"
            style={{
              color: 'var(--teal-600)',
              fontSize: 13,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}