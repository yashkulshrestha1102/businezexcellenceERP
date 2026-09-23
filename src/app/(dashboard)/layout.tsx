'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, loading, initialized, loadProfile } = useAuth();

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (initialized && !loading && !profile) {
      router.push('/login');
    }
  }, [initialized, loading, profile, router]);

  if (loading || !initialized) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        fontSize: '14px',
      }}>
        Loading...
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="app-shell">
      <Sidebar />
<main className="main">
  <ErrorBoundary>{children}</ErrorBoundary>
</main>
    </div>
  );
}