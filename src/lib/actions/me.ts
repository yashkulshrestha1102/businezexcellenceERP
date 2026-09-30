'use server';

import { requireAuth } from './_shared/auth';
import { revalidatePath } from 'next/cache';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { monthLastDay } from '@/lib/utils/date';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ============ MY PROFILE ============
export async function getMyProfile() {
  const { profile } = await requireAuth();
  return profile;
}

export async function updateMyProfile(input: { phone?: string; email?: string }) {
  const { user, supabase, serviceClient } = await requireAuth();

  const update: Record<string, unknown> = {};
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.email && input.email !== user.email) {
    update.email = input.email.trim().toLowerCase();
  }

  // Email change requires auth.admin (service role)
  if (update.email) {
    const { error: authErr } = await serviceClient.auth.admin.updateUserById(
      user.id,
      {
        email: update.email as string,
        email_confirm: true,
      }
    );
    if (authErr) throw new Error(authErr.message);
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
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
  const { user, serviceClient } = await requireAuth();

  if (!input.current || !input.newPassword) {
    throw new Error('Both current and new password required');
  }
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  // Verify current password with a fresh anonymous client
  const verifyClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error: signInErr } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: input.current,
  });
  if (signInErr) throw new Error('Current password is incorrect');

  const { error } = await serviceClient.auth.admin.updateUserById(user.id, {
    password: input.newPassword,
  });
  if (error) throw new Error(error.message);

  return { success: true };
}

// ============ MY ATTENDANCE (current month) ============
export async function getMyMonthAttendance(month?: string) {
  const { profile, supabase } = await requireAuth();

  const m = month || new Date().toISOString().slice(0, 7);
  const [year, mon] = m.split('-').map(Number);
  const start = `${m}-01`;
  const lastDay = monthLastDay(year, mon);
  const end = `${m}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
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
  const { profile, supabase } = await requireAuth();

  const { data: settings } = await supabase
    .from('company_settings')
    .select('admin_email')
    .eq('id', 1)
    .maybeSingle();

  const { error } = await supabase.from('mails').insert({
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