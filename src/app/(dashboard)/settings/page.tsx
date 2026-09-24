'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  getCompanySettings,
  updateCompanySettings,
} from '@/lib/actions/mails';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { profile } = useAuth();
  const { load: reloadCompanySettings } = useCompanySettings();
  const [settings, setSettings] = useState({
    company_name: '',
    admin_email: '',
    work_start: '09:30',
    work_end: '18:30',
    half_day_hours: 4,
    full_day_hours: 8,
    late_grace_minutes: 15,
  });
  const [pw, setPw] = useState({ current: '', newPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCompanySettings()
      .then((s) => {
        setSettings({
          company_name: s.company_name || 'Roster Pro',
          admin_email: s.admin_email || '',
          work_start: (s.work_start || '09:30').slice(0, 5),
          work_end: (s.work_end || '18:30').slice(0, 5),
          half_day_hours: Number(s.half_day_hours) || 4,
          full_day_hours: Number(s.full_day_hours) || 8,
          late_grace_minutes: Number(s.late_grace_minutes) || 15,
        });
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await updateCompanySettings(settings);
      await reloadCompanySettings(true);
      toast.success('Settings save ho gayi');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!pw.current || !pw.newPassword) return toast.error('Sab bharo');
    if (pw.newPassword.length < 6) return toast.error('Min 6 chars');
    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: pw.current,
      });
      if (signInErr) throw new Error('Current password galat');

      const { error } = await supabase.auth.updateUser({
        password: pw.newPassword,
      });
      if (error) throw new Error(error.message);

      toast.success('Password update');
      setPw({ current: '', newPassword: '' });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (loading) return <div className="empty">Loading...</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Company details, work hours, aur admin password</p>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-head">
            <h3>🏢 Company</h3>
          </div>
          <div className="panel-body">
            <div className="field">
              <label>Company Name</label>
              <input
                value={settings.company_name}
                onChange={(e) =>
                  setSettings({ ...settings, company_name: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Admin / HR Email</label>
              <input
                type="email"
                value={settings.admin_email}
                onChange={(e) =>
                  setSettings({ ...settings, admin_email: e.target.value })
                }
              />
            </div>
            <div className="grid2">
              <div className="field">
                <label>Work Start Time</label>
                <input
                  type="time"
                  value={settings.work_start}
                  onChange={(e) =>
                    setSettings({ ...settings, work_start: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Work End Time</label>
                <input
                  type="time"
                  value={settings.work_end}
                  onChange={(e) =>
                    setSettings({ ...settings, work_end: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid2">
              <div className="field">
                <label>Half Day Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.half_day_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      half_day_hours: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Full Day Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.full_day_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      full_day_hours: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label>Late Grace Minutes (late marking ke liye)</label>
              <input
                type="number"
                value={settings.late_grace_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    late_grace_minutes: Number(e.target.value),
                  })
                }
              />
            </div>
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
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
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={handleChangePassword}
            >
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}