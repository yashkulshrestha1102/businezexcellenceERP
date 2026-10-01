'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getEmployees } from '@/lib/actions/employees';
import {
  getEmployeeAttendanceReport,
  type AttendanceReportSummary,
} from '@/lib/actions/reports';
import { downloadCSV } from '@/lib/utils/export';
import { fmtDate, todayStr } from '@/lib/utils/date';
import { TableSkeleton } from '@/components/ui/Skeleton';
import type { Profile } from '@/types/database';

export default function EmployeeAttendanceReportPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    // Default: 3 months back
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(todayStr());
  const [report, setReport] = useState<AttendanceReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Load employees once
  useEffect(() => {
    getEmployees()
      .then((d) => {
        const list = d as Profile[];
        setEmployees(list);
        if (list.length > 0) setSelectedEmployee(list[0].id);
      })
      .catch((err) => toast.error((err as Error).message));
  }, []);

  async function generateReport() {
    if (!selectedEmployee) {
      toast.error('Employee select karo');
      return;
    }
    if (toDate < fromDate) {
      toast.error('To date, From se pehle nahi');
      return;
    }

    setLoading(true);
    try {
      const r = await getEmployeeAttendanceReport({
        employeeId: selectedEmployee,
        fromDate,
        toDate,
      });
      setReport(r);
      toast.success(`${r.rows.length} din ka data load hua`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    if (!report) return;
    try {
      const rows = report.rows.map((r) => ({
        Date: r.date,
        Day: r.day,
        Status: r.status,
        'Check In': r.check_in || '',
        'Check Out': r.check_out || '',
        Hours: r.hours,
        Late: r.late ? 'Yes' : 'No',
        'Short Day': r.short_day ? 'Yes' : 'No',
        Notes: r.notes || '',
      }));
      downloadCSV(
        `attendance-${report.employee.name}-${fromDate}-to-${toDate}.csv`,
        rows
      );
      toast.success('Export ready');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Quick range presets
  function setLast30Days() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(todayStr());
  }
  function setLast3Months() {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(todayStr());
  }
  function setLast6Months() {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(todayStr());
  }
  function setLastYear() {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    setFromDate(d.toISOString().slice(0, 10));
    setToDate(todayStr());
  }
  function setThisYear() {
    const y = new Date().getFullYear();
    setFromDate(`${y}-01-01`);
    setToDate(todayStr());
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Employee Attendance Report</h1>
          <p>Kisi bhi employee ka historical data dekho aur export karo</p>
        </div>
      </div>

      {/* Filters */}
      <div className="panel">
        <div className="panel-head">
          <h3>🔍 Filters</h3>
        </div>
        <div className="panel-body">
          <div className="field">
            <label>Employee *</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">— Select Employee —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.username}) {emp.dept ? `— ${emp.dept}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid2">
            <div className="field">
              <label>From Date *</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>To Date *</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                max={todayStr()}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <button className="pill" onClick={setLast30Days}>Last 30 days</button>
            <button className="pill" onClick={setLast3Months}>Last 3 months</button>
            <button className="pill" onClick={setLast6Months}>Last 6 months</button>
            <button className="pill" onClick={setLastYear}>Last 1 year</button>
            <button className="pill" onClick={setThisYear}>This year</button>
          </div>

          <button
            className="btn btn-sm"
            style={{ width: 'auto' }}
            onClick={generateReport}
            disabled={loading}
          >
            {loading ? 'Loading...' : '📊 Generate Report'}
          </button>
        </div>
      </div>

      {/* Report */}
      {loading && <TableSkeleton rows={8} />}

      {!loading && report && (
        <>
          {/* Summary */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>📊 {report.employee.name} — Summary</h3>
                <div className="sub">
                  {fmtDate(report.range.from)} → {fmtDate(report.range.to)}
                  {' • '}
                  {report.employee.dept || 'No dept'}
                  {report.employee.designation
                    ? ` • ${report.employee.designation}`
                    : ''}
                </div>
              </div>
              <button
                className="btn btn-sm"
                style={{ width: 'auto' }}
                onClick={exportReport}
              >
                📥 Export CSV
              </button>
            </div>
            <div className="panel-body">
              <div className="stats">
                <div className="stat">
                  <div className="lbl">Total Days</div>
                  <div className="val">{report.totals.totalDays}</div>
                  <div className="sub">in range</div>
                </div>
                <div className="stat">
                  <div className="lbl">Present</div>
                  <div className="val" style={{ color: 'var(--ok)' }}>
                    {report.totals.present}
                  </div>
                  <div className="sub">+ {report.totals.half} half</div>
                </div>
                <div className="stat">
                  <div className="lbl">Absent</div>
                  <div className="val" style={{ color: 'var(--danger)' }}>
                    {report.totals.absent}
                  </div>
                  <div className="sub">working days</div>
                </div>
                <div className="stat">
                  <div className="lbl">Late Count</div>
                  <div className="val" style={{ color: 'var(--warn)' }}>
                    {report.totals.lateCount}
                  </div>
                  <div className="sub">{report.totals.shortDayCount} short days</div>
                </div>
                <div className="stat">
                  <div className="lbl">Holidays</div>
                  <div className="val" style={{ color: 'var(--teal-600)' }}>
                    {report.totals.holidays}
                  </div>
                  <div className="sub">+ {report.totals.weekoffs} week-offs</div>
                </div>
                <div className="stat">
                  <div className="lbl">Total Hours</div>
                  <div className="val">{report.totals.totalHours}h</div>
                  <div className="sub">all check-ins</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="panel">
            <div className="panel-head">
              <h3>📋 Day-wise Breakdown</h3>
              <div className="sub">{report.rows.length} rows</div>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Status</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Hours</th>
                      <th>Flags</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.date}>
                        <td>{fmtDate(r.date)}</td>
                        <td>{r.day}</td>
                        <td>
                          <span
                            className={`tag ${
                              r.status === 'Present'
                                ? 'tag-green'
                                : r.status === 'Half'
                                ? 'tag-blue'
                                : r.status === 'Leave'
                                ? 'tag-amber'
                                : r.status === 'Holiday'
                                ? 'tag-teal'
                                : r.status === 'Week Off'
                                ? 'tag-gray'
                                : 'tag-rose'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>{r.check_in || '—'}</td>
                        <td>{r.check_out || '—'}</td>
                        <td>{r.hours ? `${r.hours}h` : '—'}</td>
                        <td>
                          {r.late && (
                            <span className="tag tag-amber" style={{ marginRight: 4 }}>
                              Late
                            </span>
                          )}
                          {r.short_day && (
                            <span className="tag tag-rose">Short</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {r.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !report && (
        <div className="empty">
          <div className="big">📊</div>
          Employee aur date range select karke Generate Report dabao
        </div>
      )}
    </div>
  );
}