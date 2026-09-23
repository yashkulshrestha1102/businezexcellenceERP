'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { todayStr, fmtDate } from '@/lib/utils/date';
import { getAttendanceStats } from '@/lib/actions/attendance';
import { getLeaveStats } from '@/lib/actions/leaves';
import { getAssetStats } from '@/lib/actions/assets';
import { getAllLeaves } from '@/lib/actions/leaves';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    attendance: { total: 0, present: 0, absent: 0, half: 0, leave: 0 },
    leaves: { pending: 0, approved: 0, rejected: 0, totalDays: 0 },
    assets: { total: 0, assigned: 0, available: 0, maintenance: 0 },
  });
  const [recentLeaves, setRecentLeaves] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayStr();

  useEffect(() => {
    (async () => {
      try {
        const [att, lv, as, rl] = await Promise.all([
          getAttendanceStats(today),
          getLeaveStats(),
          getAssetStats(),
          getAllLeaves(),
        ]);
        setStats({ attendance: att, leaves: lv, assets: as });
        setRecentLeaves((rl as unknown[]).slice(0, 5));
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [today]);

  if (loading) return <div className="empty">Loading dashboard...</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="lbl">Total Employees</div>
          <div className="val">{stats.attendance.total}</div>
          <div className="sub">active accounts</div>
        </div>
        <div className="stat">
          <div className="lbl">Present Today</div>
          <div className="val" style={{ color: 'var(--ok)' }}>
            {stats.attendance.present}
          </div>
          <div className="sub">
            {stats.attendance.total
              ? Math.round(
                  (stats.attendance.present / stats.attendance.total) * 100
                )
              : 0}
            % attendance
          </div>
        </div>
        <div className="stat">
          <div className="lbl">Pending Leaves</div>
          <div className="val" style={{ color: 'var(--warn)' }}>
            {stats.leaves.pending}
          </div>
          <div className="sub">need approval</div>
        </div>
        <div className="stat">
          <div className="lbl">Assets</div>
          <div className="val">
            {stats.assets.assigned}/{stats.assets.total}
          </div>
          <div className="sub">{stats.assets.available} available</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>📊 Today's Attendance Breakdown</h3>
        </div>
        <div className="panel-body">
          <div className="mini-stat">
            <div className="m">
              <b>{stats.attendance.present}</b>Present
            </div>
            <div className="m">
              <b>{stats.attendance.half}</b>Half Day
            </div>
            <div className="m">
              <b>{stats.attendance.leave}</b>On Leave
            </div>
            <div className="m">
              <b>{stats.attendance.absent}</b>Absent
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>📋 Recent Leave Requests</h3>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {recentLeaves.length === 0 ? (
            <div className="empty">
              <div className="big">📭</div>
              Koi leave request nahi
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentLeaves as Array<{
                    id: string;
                    employee: { name: string } | null;
                    from_date: string;
                    to_date: string;
                    days: number;
                    status: string;
                  }>).map((l) => (
                    <tr key={l.id}>
                      <td>
                        <b>{l.employee?.name || '—'}</b>
                      </td>
                      <td>{fmtDate(l.from_date)}</td>
                      <td>{fmtDate(l.to_date)}</td>
                      <td>{l.days}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}