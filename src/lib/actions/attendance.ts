'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { todayStr, nowTime } from '@/lib/utils/date';
import {
  DEFAULT_WORK_START,
  DEFAULT_HALF_DAY_HOURS,
  DEFAULT_LATE_GRACE_MINUTES,
} from '@/lib/constants';

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const adminClient = getAdminClient();
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('id, role, name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new Error('Profile fetch failed: ' + error.message);
  if (!profile) throw new Error('Profile not found');
  return { user, profile, adminClient };
}

async function requireAdmin() {
  const ctx = await requireAuth();
  if (ctx.profile.role !== 'admin') throw new Error('Admin only');
  return ctx;
}

// Load settings — use `any` for data since Supabase doesn't know our schema
async function getSettings(adminClient: SupabaseClient) {
  const { data } = await adminClient
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
  const { profile, adminClient } = await requireAuth();
  const today = todayStr();
  const now = nowTime();

  const { data: onLeave } = await adminClient
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

  const { data: existing } = await adminClient
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

  const settings = await getSettings(adminClient);

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
    const { error } = await adminClient
      .from('attendance')
      .update(payload)
      .eq('id', existingRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await adminClient.from('attendance').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  revalidatePath('/me/attendance');

  return { success: true, time: now, late, alreadyCheckedIn: false };
}

// ============ EMPLOYEE: CHECK OUT ============
export async function checkOut() {
  const { profile, adminClient } = await requireAuth();
  const today = todayStr();
  const now = nowTime();

  const { data: existing } = await adminClient
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

  const settings = await getSettings(adminClient);

  const [h1, m1] = String(existingRow.check_in).slice(0, 5).split(':').map(Number);
  const [h2, m2] = now.split(':').map(Number);
  const hours = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  const short_day = hours < settings.half_day_hours;

  const { error } = await adminClient
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

// ============ GET TODAY'S ATTENDANCE FOR SELF ============
export async function getMyTodayAttendance() {
  const { profile, adminClient } = await requireAuth();
  const today = todayStr();

  const { data } = await adminClient
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .eq('date', today)
    .maybeSingle();

  return data;
}

// ============ ADMIN: LIST BY DATE ============
export async function getAttendanceByDate(date: string) {
  await requireAdmin();
  const adminClient = getAdminClient();

  const [empRes, attRes] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id, name, username, dept, designation, role, is_active')
      .eq('is_active', true)
      .order('name'),
    adminClient.from('attendance').select('*').eq('date', date),
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
  await requireAdmin();
  const adminClient = getAdminClient();
  const settings = await getSettings(adminClient);

  let hours = 0;
  let short_day = false;
  if (data.check_in && data.check_out) {
    const [h1, m1] = data.check_in.split(':').map(Number);
    const [h2, m2] = data.check_out.split(':').map(Number);
    hours = Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
    short_day = hours < settings.half_day_hours;
    hours = Math.round(hours * 100) / 100;
  }

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

  const { data: existing } = await adminClient
    .from('attendance')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('date', date)
    .maybeSingle();

  const existingRow = existing as { id: string } | null;

  if (existingRow) {
    const { error } = await adminClient
      .from('attendance')
      .update(payload)
      .eq('id', existingRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await adminClient.from('attendance').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ ADMIN: CLEAR ============
export async function adminClearAttendance(employeeId: string, date: string) {
  await requireAdmin();
  const adminClient = getAdminClient();
  const { error } = await adminClient
    .from('attendance')
    .delete()
    .eq('employee_id', employeeId)
    .eq('date', date);
  if (error) throw new Error(error.message);
  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ ADMIN: MARK ALL PRESENT ============
export async function adminMarkAllPresent(date: string) {
  await requireAdmin();
  const adminClient = getAdminClient();

  const { data: employees } = await adminClient
    .from('profiles')
    .select('id')
    .eq('is_active', true)
    .eq('role', 'employee');

  const empList = (employees || []) as Array<{ id: string }>;
  if (!empList.length) return { success: true, count: 0 };

  const { data: existing } = await adminClient
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
      check_in: '09:00',
      status: 'Present' as const,
      marked_by: 'admin' as const,
    }));

  if (inserts.length > 0) {
    const { error } = await adminClient.from('attendance').insert(inserts);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true, count: inserts.length };
}

// ============ STATS ============
export async function getAttendanceStats(date: string) {
  await requireAdmin();
  const adminClient = getAdminClient();

  const [empRes, attRes] = await Promise.all([
    adminClient.from('profiles').select('id').eq('is_active', true),
    adminClient.from('attendance').select('status').eq('date', date),
  ]);

  const total = (empRes.data || []).length;
  const att = (attRes.data || []) as Array<{ status: string }>;
  const present = att.filter((a) => a.status === 'Present').length;
  const half = att.filter((a) => a.status === 'Half').length;
  const leave = att.filter((a) => a.status === 'Leave').length;
  const absent = total - present - half - leave;

  return { total, present, half, leave, absent };
}