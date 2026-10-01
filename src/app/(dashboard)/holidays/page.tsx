'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  getHolidaysByYear,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getWeekOffs,
  updateWeekOffs,
  type Holiday,
  type WeekOff,
} from '@/lib/actions/holidays';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { fmtDate } from '@/lib/utils/date';
import { useAuth } from '@/lib/hooks/useAuth';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function HolidaysPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [weekOffs, setWeekOffs] = useState<WeekOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Holiday | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, w] = await Promise.all([
        getHolidaysByYear(year),
        getWeekOffs(),
      ]);
      setHolidays(h);
      setWeekOffs(w);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteHoliday(confirmDelete.id);
      toast.success('Holiday deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggleWeekOff(dayOfWeek: number, isActive: boolean) {
    if (!isAdmin) return; // guard

    try {
      const updated = weekOffs.map((w) =>
        w.day_of_week === dayOfWeek ? { ...w, is_active: isActive } : w
      );
      setWeekOffs(updated);
      await updateWeekOffs(
        updated.map((w) => ({
          day_of_week: w.day_of_week,
          is_active: w.is_active,
        }))
      );
      toast.success('Week-off updated');
    } catch (err) {
      toast.error((err as Error).message);
      load(); // revert on failure
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Holiday Calendar</h1>
          <p>
            {isAdmin
              ? 'Company holidays aur week-offs manage karo'
              : 'Company holidays aur week-offs dekho'}
          </p>
        </div>
        {isAdmin && (
          <button
            className="btn btn-sm"
            style={{ width: 'auto' }}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            ＋ Add Holiday
          </button>
        )}
      </div>

      {/* Week-offs Panel */}
      <div className="panel">
        <div className="panel-head">
          <h3>📅 Week-Offs</h3>
          <div className="sub">
            {isAdmin
              ? 'Weekly chhutti ke din select karo'
              : 'Weekly chhutti ke din'}
          </div>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {DAY_NAMES.map((name, idx) => {
              const wo = weekOffs.find((w) => w.day_of_week === idx);
              const isActive = wo?.is_active ?? false;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => isAdmin && toggleWeekOff(idx, !isActive)}
                  disabled={!isAdmin}
                  className={`pill ${isActive ? 'active' : ''}`}
                  style={{
                    cursor: isAdmin ? 'pointer' : 'default',
                    opacity: isAdmin ? 1 : 0.85,
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Year selector + Holidays table */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>🎉 Holidays — {year}</h3>
            <div className="sub">{holidays.length} holidays</div>
          </div>
          <div className="searchbar">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setYear(year - 1)}
            >
              ← {year - 1}
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setYear(year + 1)}
            >
              {year + 1} →
            </button>
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : holidays.length === 0 ? (
            <div className="empty">
              <div className="big">🎉</div>
              {isAdmin
                ? 'Koi holiday add nahi — Add Holiday dabao'
                : 'Is year koi holiday add nahi hui'}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id}>
                      <td>{fmtDate(h.date)}</td>
                      <td>
                        {new Date(h.date + 'T00:00:00').toLocaleDateString(
                          'en-IN',
                          { weekday: 'short' }
                        )}
                      </td>
                      <td>
                        <b>{h.name}</b>
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            h.type === 'Public'
                              ? 'tag-green'
                              : h.type === 'Company'
                              ? 'tag-teal'
                              : 'tag-blue'
                          }`}
                        >
                          {h.type}
                        </span>
                      </td>
                      <td>{h.description || '—'}</td>
                      {isAdmin && (
                        <td>
                          <div className="act-btns">
                            <button
                              className="icon-btn"
                              onClick={() => {
                                setEditing(h);
                                setModalOpen(true);
                              }}
                            >
                              ✎ Edit
                            </button>
                            <button
                              className="icon-btn del"
                              onClick={() => setConfirmDelete(h)}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals — only render for admin */}
      {isAdmin && modalOpen && (
        <HolidayModal
          holiday={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {isAdmin && confirmDelete && (
        <div className="modal-bg" onClick={() => setConfirmDelete(null)}>
          <div
            className="modal"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3>⚠️ Delete {confirmDelete.name}?</h3>
              <button className="x" onClick={() => setConfirmDelete(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475569', lineHeight: 1.7 }}>
                Ye holiday permanently delete ho jayegi.
              </p>
            </div>
            <div className="modal-foot">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={handleDelete}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HolidayModal({
  holiday,
  onClose,
  onSaved,
}: {
  holiday: Holiday | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!holiday;
  const [form, setForm] = useState({
    name: holiday?.name || '',
    date: holiday?.date || new Date().toISOString().slice(0, 10),
    type: (holiday?.type || 'Public') as 'Public' | 'Optional' | 'Company',
    description: holiday?.description || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Holiday name daal');
    if (!form.date) return toast.error('Date select karo');

    setSaving(true);
    try {
      if (isEdit && holiday) {
        await updateHoliday(holiday.id, {
          name: form.name,
          date: form.date,
          type: form.type,
          description: form.description,
        });
        toast.success('Holiday updated');
      } else {
        await createHoliday({
          name: form.name,
          date: form.date,
          type: form.type,
          description: form.description,
        });
        toast.success('Holiday added');
      }
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
          <h3>{isEdit ? 'Edit Holiday' : 'Add Holiday'}</h3>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Holiday Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Diwali, Holi, Christmas..."
            />
          </div>
          <div className="grid2">
            <div className="field">
              <label>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as
                      | 'Public'
                      | 'Optional'
                      | 'Company',
                  })
                }
              >
                <option value="Public">Public</option>
                <option value="Company">Company</option>
                <option value="Optional">Optional</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Notes..."
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}