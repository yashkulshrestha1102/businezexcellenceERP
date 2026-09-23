'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fmtDate, todayStr } from '@/lib/utils/date';
import { TableSkeleton } from '@/components/ui/Skeleton';

import {
  applyLeave,
  cancelMyLeave,
  getMyLeaves,
  getMyLeaveBalance,
} from '@/lib/actions/leaves';

interface Leave {
  id: string;
  from_date: string;
  to_date: string;
  type: 'Full' | 'Half';
  days: number;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  applied_at: string;
}

export default function MyLeavePage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balance, setBalance] = useState({ approved: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([getMyLeaves(), getMyLeaveBalance()]);
      setLeaves(l as Leave[]);
      setBalance(b);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(id: string) {
    try {
      await cancelMyLeave(id);
      toast.success('Leave cancel');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My Leave</h1>
          <p>Leave apply karo aur status track karo</p>
        </div>
        <button
          className="btn btn-sm"
          style={{ width: 'auto' }}
          onClick={() => setShowForm(true)}
        >
          ＋ Apply Leave
        </button>
      </div>

      <div className="mini-stat">
        <div className="m"><b>{balance.approved}</b>Approved Days</div>
        <div className="m"><b>{balance.pending}</b>Pending</div>
        <div className="m"><b>{leaves.length}</b>Total Requests</div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
  <TableSkeleton rows={5} />
) : leaves.length === 0 ? (
            <div className="empty">
              <div className="big">🌴</div>
              Koi leave nahi — Apply Leave dabao
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Type</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Applied</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td>{fmtDate(l.from_date)}</td>
                      <td>{fmtDate(l.to_date)}</td>
                      <td>
                        {l.type === 'Half' ? (
                          <span className="tag tag-blue">Half</span>
                        ) : (
                          <span className="tag tag-gray">Full</span>
                        )}
                      </td>
                      <td><b>{l.days}</b></td>
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
                        {l.status === 'Pending' && (
                          <button
                            className="icon-btn del"
                            onClick={() => handleCancel(l.id)}
                          >
                            Cancel
                          </button>
                        )}
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
        <ApplyLeaveModal
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

function ApplyLeaveModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayStr();
  const [form, setForm] = useState({
    from_date: today,
    to_date: today,
    type: 'Full' as 'Full' | 'Half',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.reason.trim()) return toast.error('Reason daal');
    if (form.to_date < form.from_date)
      return toast.error('To date, From se pehle nahi');
    setSaving(true);
    try {
      await applyLeave(form);
      toast.success('Leave apply ho gayi — admin approval ka wait');
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
          <h3>Apply Leave</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
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
          <div className="field">
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as 'Full' | 'Half' })
              }
            >
              <option value="Full">Full Day</option>
              <option value="Half">Half Day</option>
            </select>
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
            {saving ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}