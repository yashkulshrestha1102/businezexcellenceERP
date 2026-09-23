'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { fmtDate } from '@/lib/utils/date';
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
} from '@/lib/actions/me';
import type { Profile } from '@/types/database';

export default function MyProfilePage() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ phone: '', email: '' });
  const [pw, setPw] = useState({ current: '', newPassword: '', confirm: '' });

  useEffect(() => {
    (async () => {
      try {
        const p = await getMyProfile();
        setProfile(p as Profile);
        setForm({ phone: (p as Profile).phone || '', email: (p as Profile).email });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSaveProfile() {
    try {
      await updateMyProfile(form);
      toast.success('Profile update');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleChangePassword() {
    if (!pw.current || !pw.newPassword) return toast.error('Sab fields bharo');
    if (pw.newPassword.length < 6) return toast.error('Password min 6 chars');
    if (pw.newPassword !== pw.confirm) return toast.error('Confirm match nahi');
    try {
      await changeMyPassword({
        current: pw.current,
        newPassword: pw.newPassword,
      });
      toast.success('Password update');
      setPw({ current: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (loading) return <div className="empty">Loading...</div>;
  if (!profile) return <div className="empty">Profile not found</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <p>Contact details update karo ya password badlo</p>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-head">
            <h3>👤 Basic Info</h3>
          </div>
          <div className="panel-body">
            <div className="field">
              <label>Name</label>
              <input value={profile.name} disabled />
            </div>
            <div className="field">
              <label>Department / Designation</label>
              <input
                value={`${profile.dept || '—'} — ${profile.designation || '—'}`}
                disabled
              />
            </div>
            <div className="field">
              <label>Username</label>
              <input value={profile.username} disabled />
            </div>
            <div className="field">
              <label>Joined</label>
              <input value={fmtDate(profile.join_date)} disabled />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={handleSaveProfile}
            >
              Save changes
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>🔒 Change Password</h3>
          </div>
          <div className="panel-body">
            <div className="field">
              <label>Current Password</label>
              <input
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            </div>
            <div className="field">
              <label>New Password</label>
              <input
                type="password"
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </div>
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={handleChangePassword}
            >
              Update password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}