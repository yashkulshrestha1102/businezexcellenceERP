'use server';

import { requireAuth, requireAdmin } from './_shared/auth';
import type { Profile } from '@/types/database';

// ============================================
// HISTORICAL REPORTING
// ============================================
// Admin: any employee, any range
// Employee: only their own data

export interface AttendanceReportRow {
  date: string;
  day: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  hours: number;
  late: boolean;
  short_day: boolean;
  notes: string | null;
}

export interface AttendanceReportSummary {
  employee: {
    id: string;
    name: string;
    username: string;
    dept: string | null;
    designation: string | null;
  };
  range: { from: string; to: string };
  totals: {
    totalDays: number;
    present: number;
    half: number;
    leave: number;
    absent: number;
    holidays: number;
    weekoffs: number;
    lateCount: number;
    shortDayCount: number;
    totalHours: number;
    workingDays: number;
  };
  rows: AttendanceReportRow[];
}

// ============================================
// ADMIN: One employee, any date range
// ============================================
export async function getEmployeeAttendanceReport(params: {
  employeeId: string;
  fromDate: string;
  toDate: string;
}): Promise<AttendanceReportSummary> {
  const { supabase } = await requireAdmin();

  const { employeeId, fromDate, toDate } = params;

  if (!employeeId) throw new Error('Employee ID required');
  if (!fromDate || !toDate) throw new Error('Date range required');
  if (toDate < fromDate) throw new Error('Invalid date range');

  // Fetch employee
  const { data: employee, error: empError } = await supabase
    .from('profiles')
    .select('id, name, username, dept, designation')
    .eq('id', employeeId)
    .maybeSingle();

  if (empError || !employee) throw new Error('Employee not found');

  // Fetch attendance in range
  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });

  if (attError) throw new Error(attError.message);

  // Fetch holidays in range
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', fromDate)
    .lte('date', toDate);

  const holidaySet = new Set((holidays || []).map((h) => h.date));

  // Fetch week-offs
  const { data: weekOffs } = await supabase
    .from('week_offs')
    .select('day_of_week, is_active')
    .eq('is_active', true);

  const weekOffDays = new Set(
    (weekOffs || []).map((w) => w.day_of_week as number)
  );

  // Build full range of dates
  const rows: AttendanceReportRow[] = [];
  const attMap = new Map(
    (attendance || []).map((a) => [a.date as string, a])
  );

  const start = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');

  let present = 0;
  let half = 0;
  let leave = 0;
  let absent = 0;
  let holidayCount = 0;
  let weekoffCount = 0;
  let lateCount = 0;
  let shortDayCount = 0;
  let totalHours = 0;
  let workingDays = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    const dayOfWeek = d.getDay();
    const isWeekOff = weekOffDays.has(dayOfWeek);
    const isHoliday = holidaySet.has(dateStr);

    const att = attMap.get(dateStr);

    let status: string;
    if (att?.status) {
      status = att.status;
    } else if (isHoliday) {
      status = 'Holiday';
    } else if (isWeekOff) {
      status = 'Week Off';
    } else {
      status = 'Absent';
    }

    // Count
    switch (status) {
      case 'Present':
        present++;
        workingDays++;
        break;
      case 'Half':
        half++;
        workingDays++;
        break;
      case 'Leave':
        leave++;
        break;
      case 'Absent':
        absent++;
        workingDays++;
        break;
      case 'Holiday':
        holidayCount++;
        break;
      case 'Week Off':
        weekoffCount++;
        break;
    }

    if (att?.late) lateCount++;
    if (att?.short_day) shortDayCount++;
    if (att?.hours) totalHours += Number(att.hours);

    rows.push({
      date: dateStr,
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      status,
      check_in: att?.check_in ? String(att.check_in).slice(0, 5) : null,
      check_out: att?.check_out ? String(att.check_out).slice(0, 5) : null,
      hours: Number(att?.hours || 0),
      late: Boolean(att?.late),
      short_day: Boolean(att?.short_day),
      notes: (att?.notes as string | null) || null,
    });
  }

  return {
    employee,
    range: { from: fromDate, to: toDate },
    totals: {
      totalDays: rows.length,
      present,
      half,
      leave,
      absent,
      holidays: holidayCount,
      weekoffs: weekoffCount,
      lateCount,
      shortDayCount,
      totalHours: Math.round(totalHours * 100) / 100,
      workingDays,
    },
    rows,
  };
}

// ============================================
// EMPLOYEE: Own attendance, any range
// ============================================
export async function getMyAttendanceReport(params: {
  fromDate: string;
  toDate: string;
}): Promise<AttendanceReportSummary> {
  const { profile } = await requireAuth();

  // Reuse admin logic but for self — need admin client? No.
  // We'll just query with user RLS.
  const { supabase } = await requireAuth();

  const { fromDate, toDate } = params;

  if (!fromDate || !toDate) throw new Error('Date range required');
  if (toDate < fromDate) throw new Error('Invalid date range');

  const employee = {
    id: profile.id,
    name: profile.name,
    username: profile.username,
    dept: profile.dept,
    designation: profile.designation,
  };

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });

  if (attError) throw new Error(attError.message);

  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', fromDate)
    .lte('date', toDate);

  const holidaySet = new Set((holidays || []).map((h) => h.date));

  const { data: weekOffs } = await supabase
    .from('week_offs')
    .select('day_of_week, is_active')
    .eq('is_active', true);

  const weekOffDays = new Set(
    (weekOffs || []).map((w) => w.day_of_week as number)
  );

  const rows: AttendanceReportRow[] = [];
  const attMap = new Map(
    (attendance || []).map((a) => [a.date as string, a])
  );

  const start = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');

  let present = 0;
  let half = 0;
  let leave = 0;
  let absent = 0;
  let holidayCount = 0;
  let weekoffCount = 0;
  let lateCount = 0;
  let shortDayCount = 0;
  let totalHours = 0;
  let workingDays = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    const dayOfWeek = d.getDay();
    const isWeekOff = weekOffDays.has(dayOfWeek);
    const isHoliday = holidaySet.has(dateStr);

    const att = attMap.get(dateStr);

    let status: string;
    if (att?.status) {
      status = att.status;
    } else if (isHoliday) {
      status = 'Holiday';
    } else if (isWeekOff) {
      status = 'Week Off';
    } else {
      status = 'Absent';
    }

    switch (status) {
      case 'Present':
        present++;
        workingDays++;
        break;
      case 'Half':
        half++;
        workingDays++;
        break;
      case 'Leave':
        leave++;
        break;
      case 'Absent':
        absent++;
        workingDays++;
        break;
      case 'Holiday':
        holidayCount++;
        break;
      case 'Week Off':
        weekoffCount++;
        break;
    }

    if (att?.late) lateCount++;
    if (att?.short_day) shortDayCount++;
    if (att?.hours) totalHours += Number(att.hours);

    rows.push({
      date: dateStr,
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      status,
      check_in: att?.check_in ? String(att.check_in).slice(0, 5) : null,
      check_out: att?.check_out ? String(att.check_out).slice(0, 5) : null,
      hours: Number(att?.hours || 0),
      late: Boolean(att?.late),
      short_day: Boolean(att?.short_day),
      notes: (att?.notes as string | null) || null,
    });
  }

  return {
    employee,
    range: { from: fromDate, to: toDate },
    totals: {
      totalDays: rows.length,
      present,
      half,
      leave,
      absent,
      holidays: holidayCount,
      weekoffs: weekoffCount,
      lateCount,
      shortDayCount,
      totalHours: Math.round(totalHours * 100) / 100,
      workingDays,
    },
    rows,
  };
}

// ============================================
// ADMIN: All employees summary (any range)
// ============================================
export interface AllEmployeesReportRow {
  employee_id: string;
  name: string;
  username: string;
  dept: string | null;
  present: number;
  half: number;
  leave: number;
  absent: number;
  holidays: number;
  weekoffs: number;
  lateCount: number;
  totalHours: number;
  workingDays: number;
}

export async function getAllEmployeesReport(params: {
  fromDate: string;
  toDate: string;
}): Promise<AllEmployeesReportRow[]> {
  const { supabase } = await requireAdmin();
  const { fromDate, toDate } = params;

  if (!fromDate || !toDate) throw new Error('Date range required');
  if (toDate < fromDate) throw new Error('Invalid date range');

  const [empRes, attRes, holRes, woRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, username, dept')
      .eq('is_active', true)
      .eq('role', 'employee')
      .order('name'),
    supabase
      .from('attendance')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate),
    supabase
      .from('holidays')
      .select('date')
      .gte('date', fromDate)
      .lte('date', toDate),
    supabase.from('week_offs').select('day_of_week, is_active').eq('is_active', true),
  ]);

  const employees = empRes.data || [];
  const attendance = attRes.data || [];
  const holidaySet = new Set((holRes.data || []).map((h) => h.date as string));
  const weekOffDays = new Set(
    (woRes.data || []).map((w) => w.day_of_week as number)
  );

  // Group attendance by employee
  const attByEmp = new Map<string, Map<string, (typeof attendance)[0]>>();
  for (const a of attendance) {
    const empId = a.employee_id as string;
    if (!attByEmp.has(empId)) attByEmp.set(empId, new Map());
    attByEmp.get(empId)!.set(a.date as string, a);
  }

  const start = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');

  const results: AllEmployeesReportRow[] = [];

  for (const emp of employees) {
    const dayMap = attByEmp.get(emp.id) || new Map();

    let present = 0;
    let half = 0;
    let leave = 0;
    let absent = 0;
    let holidaysCount = 0;
    let weekoffsCount = 0;
    let lateCount = 0;
    let totalHours = 0;
    let workingDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;

      const dayOfWeek = d.getDay();
      const isWeekOff = weekOffDays.has(dayOfWeek);
      const isHoliday = holidaySet.has(dateStr);

      const att = dayMap.get(dateStr);

      let status: string;
      if (att?.status) status = att.status as string;
      else if (isHoliday) status = 'Holiday';
      else if (isWeekOff) status = 'Week Off';
      else status = 'Absent';

      switch (status) {
        case 'Present':
          present++;
          workingDays++;
          break;
        case 'Half':
          half++;
          workingDays++;
          break;
        case 'Leave':
          leave++;
          break;
        case 'Absent':
          absent++;
          workingDays++;
          break;
        case 'Holiday':
          holidaysCount++;
          break;
        case 'Week Off':
          weekoffsCount++;
          break;
      }

      if (att?.late) lateCount++;
      if (att?.hours) totalHours += Number(att.hours);
    }

    results.push({
      employee_id: emp.id,
      name: emp.name,
      username: emp.username,
      dept: emp.dept,
      present,
      half,
      leave,
      absent,
      holidays: holidaysCount,
      weekoffs: weekoffsCount,
      lateCount,
      totalHours: Math.round(totalHours * 100) / 100,
      workingDays,
    });
  }

  return results;
}