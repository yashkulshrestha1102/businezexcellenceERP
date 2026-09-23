'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { todayStr } from '@/lib/utils/date';
import { downloadCSV } from '@/lib/utils/export';
import { getEmployees } from '@/lib/actions/employees';
import { getAttendanceByDate } from '@/lib/actions/attendance';
import { getAllLeaves } from '@/lib/actions/leaves';
import { getAllAssets } from '@/lib/actions/assets';
import type { Profile } from '@/types/database';

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [loading, setLoading] = useState<string | null>(null);

  async function exportEmployees() {
    setLoading('employees');
    try {
      const data = await getEmployees();
      const rows = (data as Profile[]).map((e) => ({
        ID: e.id,
        Name: e.name,
        Username: e.username,
        Email: e.email,
        Phone: e.phone || '',
        Department: e.dept || '',
        Designation: e.designation || '',
        Role: e.role,
        'Join Date': e.join_date || '',
        Salary: e.salary || 0,
        Active: e.is_active ? 'Yes' : 'No',
      }));
      downloadCSV(`employees-${todayStr()}.csv`, rows);
      toast.success(`${rows.length} employees export`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function exportAttendance() {
    setLoading('attendance');
    try {
      // Loop through dates and collect
      const start = new Date(fromDate + 'T00:00:00');
      const end = new Date(toDate + 'T00:00:00');
      const dates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
      }

      const all: Record<string, unknown>[] = [];
      for (const date of dates) {
        const data = await getAttendanceByDate(date);
        for (const r of data as Array<{
          employee: Profile;
          attendance: {
            check_in: string | null;
            check_out: string | null;
            status: string;
            hours: number;
            late: boolean;
            short_day: boolean;
          } | null;
        }>) {
          all.push({
            Date: date,
            Employee: r.employee.name,
            Username: r.employee.username,
            Department: r.employee.dept || '',
            Status: r.attendance?.status || 'Absent',
            'Check In': r.attendance?.check_in?.slice(0, 5) || '',
            'Check Out': r.attendance?.check_out?.slice(0, 5) || '',
            Hours: r.attendance?.hours || 0,
            Late: r.attendance?.late ? 'Yes' : 'No',
            'Short Day': r.attendance?.short_day ? 'Yes' : 'No',
          });
        }
      }
      downloadCSV(`attendance-${fromDate}-to-${toDate}.csv`, all);
      toast.success(`${all.length} records export`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function exportLeaves() {
    setLoading('leaves');
    try {
      const data = await getAllLeaves();
      const rows = (data as unknown as Array<{
        employee: { name: string; username: string; dept: string | null } | null;
        from_date: string;
        to_date: string;
        type: string;
        days: number;
        reason: string | null;
        status: string;
        applied_at: string;
      }>).map((l) => ({
        Employee: l.employee?.name || '',
        Username: l.employee?.username || '',
        Department: l.employee?.dept || '',
        From: l.from_date,
        To: l.to_date,
        Type: l.type,
        Days: l.days,
        Reason: l.reason || '',
        Status: l.status,
        Applied: l.applied_at?.slice(0, 10) || '',
      }));
      downloadCSV(`leaves-${todayStr()}.csv`, rows);
      toast.success(`${rows.length} leaves export`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function exportAssets() {
    setLoading('assets');
    try {
      const data = await getAllAssets();
      const rows = (data as unknown as Array<{
        name: string;
        type: string;
        serial: string | null;
        status: string;
        assigned_employee: { name: string } | null;
      }>).map((a) => ({
        Name: a.name,
        Type: a.type,
        Serial: a.serial || '',
        Status: a.status,
        'Assigned To': a.assigned_employee?.name || '',
      }));
      downloadCSV(`assets-${todayStr()}.csv`, rows);
      toast.success(`${rows.length} assets export`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reports & Export</h1>
          <p>Excel/CSV format mein data download karo</p>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <div className="panel-head">
            <h3>👥 Employees Report</h3>
          </div>
          <div className="panel-body">
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}>
              Saare employees ki list — name, contact, dept, salary, joined date
            </p>
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={exportEmployees}
              disabled={loading === 'employees'}
            >
              {loading === 'employees' ? 'Exporting...' : '📥 Download CSV'}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>🌴 Leaves Report</h3>
          </div>
          <div className="panel-body">
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}>
              Saari leaves — employee, dates, type, status
            </p>
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={exportLeaves}
              disabled={loading === 'leaves'}
            >
              {loading === 'leaves' ? 'Exporting...' : '📥 Download CSV'}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>💻 Assets Report</h3>
          </div>
          <div className="panel-body">
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}>
              Saare assets — name, serial, assigned to, status
            </p>
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={exportAssets}
              disabled={loading === 'assets'}
            >
              {loading === 'assets' ? 'Exporting...' : '📥 Download CSV'}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>🕒 Attendance Report</h3>
          </div>
          <div className="panel-body">
            <div className="grid2" style={{ marginBottom: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn btn-sm"
              style={{ width: 'auto' }}
              onClick={exportAttendance}
              disabled={loading === 'attendance'}
            >
              {loading === 'attendance' ? 'Exporting...' : '📥 Download CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}