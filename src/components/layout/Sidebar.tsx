'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { initials } from '@/lib/utils/date';
import { APP_NAME } from '@/lib/constants';

const ADMIN_NAV = [
  {
    section: 'Main',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: '📊' }],
  },
  {
    section: 'Manage',
    items: [
      { label: 'Employees', href: '/employees', icon: '👥' },
      { label: 'Attendance', href: '/attendance', icon: '🕒' },
      { label: 'Leave', href: '/leave', icon: '🌴' },
      { label: 'Assets', href: '/assets', icon: '💻' },
      { label: 'Holidays', href: '/holidays', icon: '🎉' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { label: 'Mail', href: '/mail', icon: '✉️' },
      { label: 'Employee Report', href: '/reports/employee-attendance', icon: '📊' },
      { label: 'Reports', href: '/reports', icon: '📈' },
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ],
  },
];

const EMPLOYEE_NAV = [
  {
    section: 'Main',
    items: [{ label: 'My Dashboard', href: '/dashboard', icon: '🏠' }],
  },
  {
    section: 'Self Service',
    items: [
      { label: 'My Attendance', href: '/me/attendance', icon: '🕒' },
      { label: 'My Leave', href: '/me/leave', icon: '🌴' },
      { label: 'My Assets', href: '/me/assets', icon: '💻' },
      { label: 'My Profile', href: '/me/profile', icon: '👤' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { label: 'My Attendance Report', href: '/me/reports', icon: '📊' }, // ✅ NEW
      { label: 'Holidays', href: '/holidays', icon: '🎉' }, // ✅ NEW — employees bhi dekh sake
    ],
  },
  {
    section: 'Tools',
    items: [{ label: 'Mail Admin', href: '/me/mail', icon: '✉️' }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { settings, load } = useCompanySettings();

  // ✅ Initial load — Sidebar mount hote hi settings fetch karo
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ REALTIME — Admin ne settings change ki toh sabko instant update mile
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('company_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_settings',
        },
        (payload) => {
          console.log('🔔 Company settings updated:', payload.new);
          load(true); // Force reload
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nav = profile?.role === 'admin' ? ADMIN_NAV : EMPLOYEE_NAV;
  const brandName = settings?.company_name || APP_NAME;

  // ✅ Dynamic brand initials — company name ke pehle 2 words ke initials
  const brandInitial = brandName
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    try {
      await signOut();
      toast.success('Logout ho gaya');
      router.push('/login');
      router.refresh();
    } catch (err) {
      toast.error('Logout fail: ' + (err as Error).message);
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">{brandInitial || 'RP'}</div>
        <div className="brand-text">
          <h2>{brandName}</h2>
          <span>{profile?.role === 'admin' ? 'Admin' : 'Employee'}</span>
        </div>
      </div>

      <nav>
        {nav.map((group) => (
          <div key={group.section}>
            <div className="nav-label">{group.section}</div>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
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