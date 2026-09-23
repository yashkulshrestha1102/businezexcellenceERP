'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fmtDate, todayStr } from '@/lib/utils/date';
import { getMyMonthAttendance } from '@/lib/actions/me';
import { TableSkeleton } from '@/components/ui/Skeleton';


interface Att {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  late: boolean;
  short_day: boolean;
  hours: number;
}

export default function MyAttendancePage() {
  const [rows, setRows] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyMonthAttendance();
      setRows(data as Att[]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const present = rows.filter((r) => r.status === 'Present').length;
  const half = rows.filter((r) => r.status === 'Half').length;
  const leave = rows.filter((r) => r.status === 'Leave').length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My Attendance</h1>
          <p>
            {new Date().toLocaleDateString('en-IN', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="mini-stat">
        <div className="m"><b>{present}</b>Present</div>
        <div className="m"><b>{half}</b>Half Day</div>
        <div className="m"><b>{leave}</b>Leave</div>
        <div className="m"><b>{rows.length}</b>Total Records</div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>📅 This Month</h3>
          <div className="sub">{rows.length} records</div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
  <TableSkeleton rows={5} />
) : filtered.length === 0 ? (
            <div className="empty">
              <div className="big">📅</div>
              Is month koi record nahi
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDate(a.date)}</td>
                      <td>
                        {new Date(a.date + 'T00:00:00').toLocaleDateString(
                          'en-IN',
                          { weekday: 'short' }
                        )}
                      </td>
                      <td>{a.check_in?.slice(0, 5) || '—'}</td>
                      <td>{a.check_out?.slice(0, 5) || '—'}</td>
                      <td>{a.hours ? `${a.hours}h` : '—'}</td>
                      <td>
                        <span
                          className={`tag ${
                            a.status === 'Present'
                              ? 'tag-green'
                              : a.status === 'Half'
                              ? 'tag-blue'
                              : a.status === 'Leave'
                              ? 'tag-amber'
                              : 'tag-rose'
                          }`}
                        >
                          {a.status}
                        </span>
                        {a.late && (
                          <span className="tag tag-amber" style={{ marginLeft: 6 }}>
                            Late
                          </span>
                        )}
                        {a.short_day && (
                          <span className="tag tag-rose" style={{ marginLeft: 6 }}>
                            Short
                          </span>
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
    </div>
  );
}