'use server';

import { requireAuth, requireAdmin } from './_shared/auth';
import { revalidatePath } from 'next/cache';
import { todayStr, nowTime } from '@/lib/utils/date';


import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { logAudit, getRequestMeta } from '@/lib/audit';
import {
  DEFAULT_WORK_START,
  DEFAULT_HALF_DAY_HOURS,
  DEFAULT_LATE_GRACE_MINUTES,
} from '@/lib/constants';
import type { SupabaseClient } from '@supabase/supabase-js';

async function getSettings(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('company_settings')
    .select('work_start, half_day_hours, late_grace_minutes')
    .eq('id', 1)
    .maybeSingle();

  const row = data as {
    work_start: string | null;
    half_day_hours: number | null;
    late_grace_minutes: number | null;
  } | null;

  return {
    work_start: row?.work_start || DEFAULT_WORK_START,
    half_day_hours: row?.half_day_hours ?? DEFAULT_HALF_DAY_HOURS,
    late_grace_minutes: row?.late_grace_minutes ?? DEFAULT_LATE_GRACE_MINUTES,
  };
}

// ============ EMPLOYEE: CHECK IN ============
export async function checkIn() {
  const { profile, supabase } = await requireAuth();
  // ✅ Rate limit
  const ip = await getClientIp();
  const limit = checkRateLimit(`checkin:${profile.id}`, RATE_LIMITS.CHECK_IN);
  if (!limit.success) {
    throw new Error(`Too many attempts. Wait ${limit.retryAfterSeconds}s`);
  }

  const today = todayStr();
  const now = nowTime();

  const { data: onLeave } = await supabase
    .from('leaves')
    .select('id')
    .eq('employee_id', profile.id)
    .eq('status', 'Approved')
    .eq('type', 'Full')
    .lte('from_date', today)
    .gte('to_date', today)
    .maybeSingle();

  if (onLeave) {
    throw new Error('Aaj tumhari approved leave hai, check-in ki zaroorat nahi');
  }

  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .eq('date', today)
    .maybeSingle();

  const existingRow = existing as {
    id: string;
    check_in: string | null;
    check_out: string | null;
  } | null;

  if (existingRow?.check_in) {
    return {
      success: false,
      alreadyCheckedIn: true,
      time: String(existingRow.check_in).slice(0, 5),
      message: `Aaj already ${String(existingRow.check_in).slice(0, 5)} pe check-in kar chuke ho`,
    };
  }

  const settings = await getSettings(supabase);

  const [wsH, wsM] = String(settings.work_start).slice(0, 5).split(':').map(Number);
  const [nH, nM] = now.split(':').map(Number);
  const nowMin = nH * 60 + nM;
  const lateThresholdMin = wsH * 60 + wsM + settings.late_grace_minutes;
  const late = nowMin > lateThresholdMin;

  const payload = {
    employee_id: profile.id,
    date: today,
    check_in: now,
    status: 'Present' as const,
    late,
    marked_by: 'self' as const,
  };

  if (existingRow) {
    const { error } = await supabase
      .from('attendance')
      .update(payload)
      .eq('id', existingRow.id);
    if (error) throw new Error(error.message);
  } else {
  const { error } = await supabase.from('attendance').insert(payload);
  if (error) {
    // ✅ Friendly error for race condition
    if (error.code === '23505') {
      // Unique constraint violation
      return {
        success: false,
        alreadyCheckedIn: true,
        message: 'Aaj already check-in ho chuka hai',
      };
    }
    throw new Error(error.message);
  }
}

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  revalidatePath('/me/attendance');

  return { success: true, time: now, late, alreadyCheckedIn: false };
}

// ============ EMPLOYEE: CHECK OUT ============
export async function checkOut() {
  const { profile, supabase } = await requireAuth();
  const today = todayStr();
  const now = nowTime();

  const { data: existing } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .eq('date', today)
    .maybeSingle();

  const existingRow = existing as {
    id: string;
    check_in: string | null;
    check_out: string | null;
  } | null;

  if (!existingRow?.check_in) throw new Error('Pehle check-in karo');

  if (existingRow.check_out) {
    return {
      success: false,
      alreadyCheckedOut: true,
      time: String(existingRow.check_out).slice(0, 5),
      message: `Aaj already ${String(existingRow.check_out).slice(0, 5)} pe check-out kar chuke ho`,
    };
  }

  const settings = await getSettings(supabase);

  const [h1, m1] = String(existingRow.check_in).slice(0, 5).split(':').map(Number);
  const [h2, m2] = now.split(':').map(Number);
  const hours = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  const short_day = hours < settings.half_day_hours;

  const { error } = await supabase
    .from('attendance')
    .update({
      check_out: now,
      hours: Math.round(hours * 100) / 100,
      short_day,
    })
    .eq('id', existingRow.id);

  if (error) throw new Error(error.message);

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  revalidatePath('/me/attendance');

  return { success: true, time: now, hours, short_day, alreadyCheckedOut: false };
}

// ============ GET TODAY'S ATTENDANCE ============
export async function getMyTodayAttendance() {
  const { profile, supabase } = await requireAuth();
  const today = todayStr();

  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .eq('date', today)
    .maybeSingle();

  return data;
}

// ============ ADMIN: LIST BY DATE ============
export async function getAttendanceByDate(date: string) {
  const { supabase } = await requireAdmin();

  const [empRes, attRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, username, dept, designation, role, is_active')
      .eq('is_active', true)
      .order('name'),
    supabase.from('attendance').select('*').eq('date', date),
  ]);

  const employees = (empRes.data || []) as Array<{
    id: string;
    name: string;
    username: string;
    dept: string | null;
    designation: string | null;
    role: string;
    is_active: boolean;
  }>;

  const attendance = (attRes.data || []) as Array<{
    employee_id: string;
    [key: string]: unknown;
  }>;

  const attMap = new Map(attendance.map((a) => [a.employee_id, a]));

  return employees.map((emp) => ({
    employee: emp,
    attendance: attMap.get(emp.id) || null,
  }));
}

// ============ ADMIN: SET / OVERRIDE ============
export async function adminSetAttendance(

  
  employeeId: string,
  date: string,
  data: {
    check_in?: string | null;
    check_out?: string | null;
    status: 'Present' | 'Half' | 'Leave' | 'Absent';
    notes?: string;
  }
) {
  const { supabase } = await requireAdmin();
  const settings = await getSettings(supabase);

  let hours = 0;
  let short_day = false;
  if (data.check_in && data.check_out) {
    const [h1, m1] = data.check_in.split(':').map(Number);
    const [h2, m2] = data.check_out.split(':').map(Number);
    hours = Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
    short_day = hours < settings.half_day_hours;
    hours = Math.round(hours * 100) / 100;
  }
  const meta = await getRequestMeta();
  await logAudit({
    actor_id: (await requireAdmin()).profile.id,
    actor_email: (await requireAdmin()).profile.email,
    action: 'attendance.admin_override',
    entity_type: 'attendance',
    entity_id: `${employeeId}:${date}`,
    new_data: { status: data.status, check_in: data.check_in, check_out: data.check_out },
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  const payload = {
    employee_id: employeeId,
    date,
    check_in: data.check_in || null,
    check_out: data.check_out || null,
    status: data.status,
    hours,
    short_day,
    marked_by: 'admin' as const,
    notes: data.notes || '',
  };

  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('date', date)
    .maybeSingle();

  const existingRow = existing as { id: string } | null;

  if (existingRow) {
    const { error } = await supabase
      .from('attendance')
      .update(payload)
      .eq('id', existingRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('attendance').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ ADMIN: CLEAR ============
export async function adminClearAttendance(employeeId: string, date: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('employee_id', employeeId)
    .eq('date', date);
  if (error) throw new Error(error.message);
  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ ADMIN: MARK ALL PRESENT (Bug Fixed ✅) ============
export async function adminMarkAllPresent(date: string) {
  const { supabase } = await requireAdmin();
  const settings = await getSettings(supabase); // ✅ Settings load karo

  const { data: employees } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true)
    .eq('role', 'employee');

  const empList = (employees || []) as Array<{ id: string }>;
  if (!empList.length) return { success: true, count: 0 };

  const { data: existing } = await supabase
    .from('attendance')
    .select('employee_id')
    .eq('date', date);

  const existingIds = new Set(
    ((existing || []) as Array<{ employee_id: string }>).map((a) => a.employee_id)
  );

  const inserts = empList
    .filter((e) => !existingIds.has(e.id))
    .map((e) => ({
      employee_id: e.id,
      date,
      check_in: String(settings.work_start).slice(0, 5), // ✅ Settings se time
      status: 'Present' as const,
      marked_by: 'admin' as const,
    }));

  if (inserts.length > 0) {
    const { error } = await supabase.from('attendance').insert(inserts);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true, count: inserts.length };
}

// ============ STATS (FIXED) ============
export async function getAttendanceStats(date: string) {
  const { supabase } = await requireAdmin();

  // 1. Sirf employees count karo (admins nahi)
  // 2. Leave pe hai kaun — check karo
  // 3. Attendance records fetch karo
  const [empRes, attRes, leaveRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .eq('role', 'employee'), // ✅ Sirf employees
    supabase.from('attendance').select('employee_id, status').eq('date', date),
    supabase
      .from('leaves')
      .select('employee_id')
      .eq('status', 'Approved')
      .eq('type', 'Full')
      .lte('from_date', date)
      .gte('to_date', date), // ✅ Aaj leave pe hain
  ]);

  const total = (empRes.data || []).length;
  const att = (attRes.data || []) as Array<{
    employee_id: string;
    status: string;
  }>;

  const empIds = new Set((empRes.data || []).map((e) => e.id));
  const attMap = new Map(att.map((a) => [a.employee_id, a.status]));
  const leaveIds = new Set(
    ((leaveRes.data || []) as Array<{ employee_id: string }>).map(
      (l) => l.employee_id
    )
  );

  // Count based on employee IDs
  let present = 0;
  let half = 0;
  let leave = 0;
  let absent = 0;

  for (const empId of empIds) {
    const status = attMap.get(empId);

    if (status === 'Present') present++;
    else if (status === 'Half') half++;
    else if (status === 'Leave') leave++;
    else if (status === 'Absent') absent++;
    else if (leaveIds.has(empId)) {
      // ✅ Leave table me hai but attendance table me record nahi
      leave++;
    } else {
      // ✅ Koi record nahi = absent
      absent++;
    }
  }

  return { total, present, half, leave, absent };
}



// ============ ADMIN: BULK ATTENDANCE FOR RANGE ============
export async function getAttendanceRange(
  fromDate: string,
  toDate: string
) {
  const { supabase } = await requireAdmin();

  const [empRes, attRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, username, dept, designation, role, is_active')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('attendance')
      .select('*')
      .gte('date', fromDate)
      .lte('date', toDate), // ✅ Single query for entire range
  ]);

  const employees = (empRes.data || []) as Array<{
    id: string;
    name: string;
    username: string;
    dept: string | null;
    designation: string | null;
    role: string;
    is_active: boolean;
  }>;

  const attendance = (attRes.data || []) as Array<{
    employee_id: string;
    date: string;
    [key: string]: unknown;
  }>;

  // Group attendance by date + employee
  const attByDateEmp = new Map<string, Map<string, typeof attendance[0]>>();
  for (const a of attendance) {
    if (!attByDateEmp.has(a.date)) {
      attByDateEmp.set(a.date, new Map());
    }
    attByDateEmp.get(a.date)!.set(a.employee_id, a);
  }

  return { employees, attByDateEmp };
}