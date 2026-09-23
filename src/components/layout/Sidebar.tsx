'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { initials } from '@/lib/utils/date';

const ADMIN_NAV = [
  { section: 'Main', items: [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  ]},
  { section: 'Manage', items: [
    { label: 'Employees', href: '/employees', icon: '👥' },
    { label: 'Attendance', href: '/attendance', icon: '🕒' },
    { label: 'Leave', href: '/leave', icon: '🌴' },
    { label: 'Assets', href: '/assets', icon: '💻' },
  ]},
  { section: 'Tools', items: [
    { label: 'Mail', href: '/mail', icon: '✉️' },
    { label: 'Reports', href: '/reports', icon: '📈' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
  ]},
];

const EMPLOYEE_NAV = [
  { section: 'Main', items: [
    { label: 'My Dashboard', href: '/dashboard', icon: '🏠' },
  ]},
  { section: 'Self Service', items: [
    { label: 'My Attendance', href: '/me/attendance', icon: '🕒' },
    { label: 'My Leave', href: '/me/leave', icon: '🌴' },
    { label: 'My Assets', href: '/me/assets', icon: '💻' },
    { label: 'My Profile', href: '/me/profile', icon: '👤' },
  ]},
  { section: 'Tools', items: [
    { label: 'Mail Admin', href: '/me/mail', icon: '✉️' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();

  const nav = profile?.role === 'admin' ? ADMIN_NAV : EMPLOYEE_NAV;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Logout ho gaya');
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">📋</div>
        <div className="brand-text">
          <h2>Roster Pro</h2>
          <span>{profile?.role === 'admin' ? 'Admin' : 'Employee'}</span>
        </div>
      </div>

      <nav>
        {nav.map((group) => (
          <div key={group.section}>
            <div className="nav-label">{group.section}</div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="ico">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">{initials(profile?.name)}</div>
          <div className="info">
            <b>{profile?.name || 'User'}</b>
            <span>{profile?.role || 'employee'}</span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          ⎋ <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}