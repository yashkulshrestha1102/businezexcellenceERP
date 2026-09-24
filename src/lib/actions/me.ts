'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { MIN_PASSWORD_LENGTH, HALF_LEAVE_DAYS } from '@/lib/constants';
import { monthLastDay } from '@/lib/utils/date';

function getAdminClient() {
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
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new Error('Profile fetch failed: ' + error.message);
  if (!profile) throw new Error('Profile not found');

  return { user, profile, adminClient };
}

// ============ MY PROFILE ============
export async function getMyProfile() {
  const { profile } = await requireAuth();
  return profile;
}

export async function updateMyProfile(input: { phone?: string; email?: string }) {
  const { user, adminClient } = await requireAuth();

  const update: Record<string, unknown> = {};
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.email && input.email !== user.email) {
    update.email = input.email.trim().toLowerCase();
  }

  if (update.email) {
    const { error: authErr } = await adminClient.auth.admin.updateUserById(user.id, {
      email: update.email as string,
      email_confirm: true,
    });
    if (authErr) throw new Error(authErr.message);
  }

  if (Object.keys(update).length > 0) {
    const { error } = await adminClient
      .from('profiles')
      .update(update)
      .eq('id', user.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/me/profile');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function changeMyPassword(input: {
  current: string;
  newPassword: string;
}) {
  const { user, adminClient } = await requireAuth();

  if (!input.current || !input.newPassword) {
    throw new Error('Both current and new password required');
  }
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: input.current,
  });
  if (signInErr) throw new Error('Current password is incorrect');

  const { error } = await adminClient.auth.admin.updateUserById(user.id, {
    password: input.newPassword,
  });
  if (error) throw new Error(error.message);

  return { success: true };
}

// ============ MY ATTENDANCE (current month) ============
export async function getMyMonthAttendance(month?: string) {
  const { profile, adminClient } = await requireAuth();

  const m = month || new Date().toISOString().slice(0, 7);
  const [year, mon] = m.split('-').map(Number);
  const start = `${m}-01`;
  const lastDay = monthLastDay(year, mon);
  const end = `${m}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await adminClient
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  if (error) throw new Error('Attendance fetch failed: ' + error.message);
  return data || [];
}

// ============ MAIL ADMIN ============
export async function sendMailToAdmin(input: {
  subject: string;
  body: string;
}) {
  const { profile, adminClient } = await requireAuth();

  const { data: settings } = await adminClient
    .from('company_settings')
    .select('admin_email')
    .eq('id', 1)
    .maybeSingle();

  const { error } = await adminClient.from('mails').insert({
    from_user: profile.id,
    from_name: profile.name,
    to_email: settings?.admin_email || 'admin@rosterpro.com',
    subject: input.subject,
    body: input.body,
  });

  if (error) {
    console.warn('Mail insert failed:', error.message);
    return { success: true, note: 'logged only' };
  }

  return { success: true };
}