'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { initials, fmtDate, todayStr, nowTime } from '@/lib/utils/date';
import { TableSkeleton } from '@/components/ui/Skeleton';

import {
  getAttendanceByDate,
  adminSetAttendance,
  adminClearAttendance,
  adminMarkAllPresent,
  getAttendanceStats,
} from '@/lib/actions/attendance';
import type { Profile } from '@/types/database';

interface Row {
  employee: Profile;
  attendance: {
    id: string;
    check_in: string | null;
    check_out: string | null;
    status: string;
    late: boolean;
    short_day: boolean;
    hours: number;
    marked_by: string;
  } | null;
}

export default function AttendancePage() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ total: 0, present: 0, half: 0, leave: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        getAttendanceByDate(date),
        getAttendanceStats(date),
      ]);
      setRows(data as Row[]);
      setStats(s);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = search.trim()
    ? rows.filter((r) =>
        r.employee.name.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  async function handleMarkAll() {
    try {
      const res = await adminMarkAllPresent(date);
      toast.success(`${res.count} employees ko present mark kiya`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleClear(employeeId: string) {
    try {
      await adminClearAttendance(employeeId, date);
      toast.success('Attendance clear');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Attendance</h1>
          <p>Employees khud check-in karte hain — admin override bhi kar sakta hai</p>
        </div>
        <div className="searchbar">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
          {date !== todayStr() && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setDate(todayStr())}
            >
              Today
            </button>
          )}
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="lbl">Present</div>
          <div className="val" style={{ color: 'var(--ok)' }}>{stats.present}</div>
        </div>
        <div className="stat">
          <div className="lbl">Half Day</div>
          <div className="val" style={{ color: '#1e40af' }}>{stats.half}</div>
        </div>
        <div className="stat">
          <div className="lbl">On Leave</div>
          <div className="val" style={{ color: 'var(--warn)' }}>{stats.leave}</div>
        </div>
        <div className="stat">
          <div className="lbl">Absent</div>
          <div className="val" style={{ color: 'var(--danger)' }}>{stats.absent}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>📅 {fmtDate(date)}</h3>
            <div className="sub">{filtered.length} shown of {rows.length}</div>
          </div>
          <div className="searchbar">
            <input
              placeholder="🔍 Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-sm btn-ghost" onClick={handleMarkAll}>
              ✓ Mark all present
            </button>
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
  <TableSkeleton rows={5} />
) : filtered.length === 0 ? (
            <div className="empty">
              <div className="big">📅</div>
              Koi employee nahi mila
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const a = r.attendance;
                    return (
                      <tr key={r.employee.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div
                              className="avatar"
                              style={{ width: 30, height: 30, fontSize: 11 }}
                            >
                              {initials(r.employee.name)}
                            </div>
                            <div>
                              <b>{r.employee.name}</b>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {r.employee.dept || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {a?.check_in ? (
                            <span className="tag tag-green">{a.check_in.slice(0, 5)}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {a?.check_out ? (
                            <span className="tag tag-gray">{a.check_out.slice(0, 5)}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{a?.hours ? `${a.hours}h` : '—'}</td>
                        <td>
                          <span className={`tag ${
                            a?.status === 'Present' ? 'tag-green' :
                            a?.status === 'Half' ? 'tag-blue' :
                            a?.status === 'Leave' ? 'tag-amber' : 'tag-rose'
                          }`}>
                            {a?.status || 'Absent'}
                          </span>
                          {a?.late && <span className="tag tag-amber" style={{ marginLeft: 6 }}>Late</span>}
                          {a?.short_day && <span className="tag tag-rose" style={{ marginLeft: 6 }}>Short</span>}
                          {a?.marked_by === 'admin' && (
                            <span className="tag tag-teal" style={{ marginLeft: 6 }}>Admin</span>
                          )}
                        </td>
                        <td>
                          <div className="act-btns">
                            <button
                              className="icon-btn"
                              onClick={() => setEditRow(r)}
                            >
                              ✎ Set
                            </button>
                            {a && (
                              <button
                                className="icon-btn del"
                                onClick={() => handleClear(r.employee.id)}
                              >
                                ✕ Clear
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editRow && (
        <AttendanceModal
          row={editRow}
          date={date}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AttendanceModal({
  row,
  date,
  onClose,
  onSaved,
}: {
  row: Row;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const a = row.attendance;
  const [checkIn, setCheckIn] = useState(a?.check_in?.slice(0, 5) || nowTime());
  const [checkOut, setCheckOut] = useState(a?.check_out?.slice(0, 5) || '');
  const [status, setStatus] = useState<'Present' | 'Half' | 'Leave' | 'Absent'>(
    (a?.status as 'Present' | 'Half' | 'Leave' | 'Absent') || 'Present'
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await adminSetAttendance(row.employee.id, date, {
        check_in: checkIn || null,
        check_out: checkOut || null,
        status,
        notes,
      });
      toast.success('Attendance set ho gayi');
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
          <h3>Set Attendance — {row.employee.name}</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="notice notice-info">
            Admin override — ye employee ki self-marked attendance ko replace karega.
          </div>
          <div className="grid2">
            <div className="field">
              <label>Check In</label>
              <input
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Check Out</label>
              <input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'Present' | 'Half' | 'Leave' | 'Absent')
              }
            >
              <option value="Present">Present</option>
              <option value="Half">Half</option>
              <option value="Leave">Leave</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
          <div className="field">
            <label>Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for override..."
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