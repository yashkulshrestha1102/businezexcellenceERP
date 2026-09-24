'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing');
    throw new Error('Server configuration error: missing Supabase URL');
  }
  if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
    throw new Error('Server configuration error: missing service role key');
  }

  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const adminClient = getAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('Profile fetch failed: ' + profileError.message);
  }
  if (!profile) throw new Error('Profile not found');

  return { user, profile, adminClient };
}

async function requireAdmin() {
  const ctx = await requireAuth();
  if (ctx.profile.role !== 'admin') throw new Error('Admin only');
  return ctx;
}

// Get today's date in local timezone (YYYY-MM-DD)
function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
}

// ============ EMPLOYEE: CHECK IN ============
export async function checkIn() {
  const { profile, adminClient } = await requireAuth();
  const today = todayStr();
  const now = nowTime();

  // Check if on approved leave today
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
    throw new Error(
      'Aaj tumhari approved leave hai, check-in ki zaroorat nahi'
    );
  }

  // Check existing
  const { data: existing } = await adminClient
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .eq('date', today)
    .maybeSingle();

  if (existing?.check_in) {
    // Return info instead of throwing 500
    return {
      success: false,
      alreadyCheckedIn: true,
      time: existing.check_in.slice(0, 5),
      message: `Aaj already ${existing.check_in.slice(
        0,
        5
      )} pe check-in kar chuke ho`,
    };
  }

  // Get work start time
  const { data: settings } = await adminClient
    .from('company_settings')
    .select('work_start')
    .eq('id', 1)
    .maybeSingle();

  const workStart = settings?.work_start || '09:30';
  const late = now > workStart.slice(0, 5);

  const payload = {
    employee_id: profile.id,
    date: today,
    check_in: now,
    status: 'Present' as const,
    late,
    marked_by: 'self' as const,
  };

  if (existing) {
    const { error } = await adminClient
      .from('attendance')
      .update(payload)
      .eq('id', existing.id);
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

  if (!existing?.check_in) throw new Error('Pehle check-in karo');

  if (existing.check_out) {
    return {
      success: false,
      alreadyCheckedOut: true,
      time: existing.check_out.slice(0, 5),
      message: `Aaj already ${existing.check_out.slice(
        0,
        5
      )} pe check-out kar chuke ho`,
    };
  }

  // Calculate hours
  const [h1, m1] = existing.check_in.split(':').map(Number);
  const [h2, m2] = now.split(':').map(Number);
  const hours = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  const short_day = hours < 4;

  const { error } = await adminClient
    .from('attendance')
    .update({
      check_out: now,
      hours: Math.round(hours * 100) / 100,
      short_day,
    })
    .eq('id', existing.id);

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

// ============ ADMIN: LIST ATTENDANCE BY DATE ============
export async function getAttendanceByDate(date: string) {
  await requireAdmin();

  const adminClient = getAdminClient();

  const { data: employees } = await adminClient
    .from('profiles')
    .select('id, name, username, dept, designation, role, is_active')
    .eq('is_active', true)
    .order('name');

  const { data: attendance } = await adminClient
    .from('attendance')
    .select('*')
    .eq('date', date);

  const attMap = new Map((attendance || []).map((a) => [a.employee_id, a]));

  return (employees || []).map((emp) => ({
    employee: emp,
    attendance: attMap.get(emp.id) || null,
  }));
}

// ============ ADMIN: SET / OVERRIDE ATTENDANCE ============
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

  let hours = 0;
  let short_day = false;
  if (data.check_in && data.check_out) {
    const [h1, m1] = data.check_in.split(':').map(Number);
    const [h2, m2] = data.check_out.split(':').map(Number);
    hours = Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
    short_day = hours < 4;
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

  if (existing) {
    const { error } = await adminClient
      .from('attendance')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await adminClient.from('attendance').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/attendance');
  revalidatePath('/dashboard');

  return { success: true };
}

// ============ ADMIN: CLEAR ATTENDANCE ============
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

  if (!employees) return { success: true, count: 0 };

  const { data: existing } = await adminClient
    .from('attendance')
    .select('employee_id')
    .eq('date', date);

  const existingIds = new Set((existing || []).map((a) => a.employee_id));

  const inserts = employees
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

// ============ STATS FOR DASHBOARD ============
export async function getAttendanceStats(date: string) {
  await requireAdmin();
  const adminClient = getAdminClient();

  const { data: employees } = await adminClient
    .from('profiles')
    .select('id')
    .eq('is_active', true);

  const { data: attendance } = await adminClient
    .from('attendance')
    .select('status')
    .eq('date', date);

  const total = employees?.length || 0;
  const present = (attendance || []).filter(
    (a) => a.status === 'Present'
  ).length;
  const half = (attendance || []).filter((a) => a.status === 'Half').length;
  const leave = (attendance || []).filter((a) => a.status === 'Leave').length;
  const absent = total - present - half - leave;

  return { total, present, half, leave, absent };
}