'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fmtDate, initials } from '@/lib/utils/date';
import { TableSkeleton } from '@/components/ui/Skeleton';
import {
  getAllLeaves,
  reviewLeave,
  deleteLeave,
  getLeaveStats,
  adminCreateLeave,
} from '@/lib/actions/leaves';
import { getEmployees } from '@/lib/actions/employees';
import type { Profile } from '@/types/database';

interface LeaveRow {
  id: string;
  employee_id: string;
  from_date: string;
  to_date: string;
  type: 'Full' | 'Half';
  days: number;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  applied_at: string;
  employee: { id: string; name: string; username: string; dept: string | null } | null;
}

export default function LeavePage() {
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalDays: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<Profile[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([getAllLeaves(filter), getLeaveStats()]);
      setLeaves(data as unknown as LeaveRow[]);
      setStats(s);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showForm && employees.length === 0) {
      getEmployees().then((d) => setEmployees(d as Profile[])).catch(() => {});
    }
  }, [showForm, employees.length]);

  async function handleReview(id: string, status: 'Approved' | 'Rejected') {
    try {
      await reviewLeave(id, status);
      toast.success(`Leave ${status.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLeave(id);
      toast.success('Leave delete');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Leave Management</h1>
          <p>Employees khud apply karte hain — yahan approve/reject karo</p>
        </div>
        <button
          className="btn btn-sm"
          style={{ width: 'auto' }}
          onClick={() => setShowForm(true)}
        >
          ＋ Log Leave
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="lbl">Pending</div>
          <div className="val" style={{ color: 'var(--warn)' }}>{stats.pending}</div>
        </div>
        <div className="stat">
          <div className="lbl">Approved</div>
          <div className="val" style={{ color: 'var(--ok)' }}>{stats.approved}</div>
        </div>
        <div className="stat">
          <div className="lbl">Rejected</div>
          <div className="val" style={{ color: 'var(--danger)' }}>{stats.rejected}</div>
        </div>
        <div className="stat">
          <div className="lbl">Approved Days</div>
          <div className="val">{stats.totalDays}</div>
        </div>
      </div>

      <div className="pill-row">
        {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
          <div
            key={f}
            className={`pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
            {f === 'Pending' && stats.pending > 0 && ` (${stats.pending})`}
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
  <TableSkeleton rows={5} />
) : filtered.length === 0 ? (
            <div className="empty">
              <div className="big">🌴</div>
              Koi leave record nahi
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Type</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Applied</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div
                            className="avatar"
                            style={{ width: 30, height: 30, fontSize: 11 }}
                          >
                            {initials(l.employee?.name)}
                          </div>
                          <div>
                            <b>{l.employee?.name || '—'}</b>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {l.employee?.dept || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{fmtDate(l.from_date)}</td>
                      <td>{fmtDate(l.to_date)}</td>
                      <td>
                        {l.type === 'Half' ? (
                          <span className="tag tag-blue">Half</span>
                        ) : (
                          <span className="tag tag-gray">Full</span>
                        )}
                      </td>
                      <td>
                        <b>{l.days}</b>
                      </td>
                      <td>{l.reason || '—'}</td>
                      <td>{fmtDate(l.applied_at?.slice(0, 10))}</td>
                      <td>
                        <span
                          className={`tag ${
                            l.status === 'Approved'
                              ? 'tag-green'
                              : l.status === 'Pending'
                              ? 'tag-amber'
                              : 'tag-rose'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td>
                        <div className="act-btns">
                          {l.status === 'Pending' && (
                            <>
                              <button
                                className="icon-btn"
                                style={{ background: '#d1fae5', color: '#065f46' }}
                                onClick={() => handleReview(l.id, 'Approved')}
                              >
                                ✓
                              </button>
                              <button
                                className="icon-btn del"
                                onClick={() => handleReview(l.id, 'Rejected')}
                              >
                                ✕
                              </button>
                            </>
                          )}
                          <button
                            className="icon-btn del"
                            onClick={() => handleDelete(l.id)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <AdminLeaveModal
          employees={employees}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AdminLeaveModal({
  employees,
  onClose,
  onSaved,
}: {
  employees: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    from_date: today,
    to_date: today,
    type: 'Full' as 'Full' | 'Half',
    reason: '',
    status: 'Approved' as 'Pending' | 'Approved' | 'Rejected',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.employee_id) return toast.error('Employee select karo');
    if (!form.reason.trim()) return toast.error('Reason daal');
    setSaving(true);
    try {
      await adminCreateLeave(form);
      toast.success('Leave log ho gayi');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Log Leave (Admin)</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Employee *</label>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            >
              <option value="">— Select —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.username})
                </option>
              ))}
            </select>
          </div>
          <div className="grid2">
            <div className="field">
              <label>From *</label>
              <input
                type="date"
                value={form.from_date}
                onChange={(e) => setForm({ ...form, from_date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>To *</label>
              <input
                type="date"
                value={form.to_date}
                onChange={(e) => setForm({ ...form, to_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as 'Full' | 'Half' })
                }
              >
                <option value="Full">Full</option>
                <option value="Half">Half</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as 'Pending' | 'Approved' | 'Rejected',
                  })
                }
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Reason *</label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Fever, bank work..."
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}