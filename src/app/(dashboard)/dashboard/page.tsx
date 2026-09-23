'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading) {
  return (
    <div className="page-loader">
      <div className="spinner spinner-dark" />
      <span>Loading dashboard...</span>
    </div>
  );
}

  if (!profile) return null;

  return profile.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />;
}