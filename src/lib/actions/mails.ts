'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

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

// ============ SEND MAIL ============
export async function sendMail(input: {
  to_email: string;
  subject: string;
  body: string;
}) {
  const { profile, adminClient } = await requireAuth();

  if (!input.to_email.trim()) throw new Error('Recipient email required');
  if (!input.subject.trim()) throw new Error('Subject required');
  if (!input.body.trim()) throw new Error('Body required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to_email)) {
    throw new Error('Invalid email format');
  }

  const { data, error } = await adminClient
    .from('mails')
    .insert({
      from_user: profile.id,
      from_name: profile.name,
      to_email: input.to_email.trim().toLowerCase(),
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/mail');
  revalidatePath('/me/mail');
  return data;
}

// ============ GET ALL MAILS ============
export async function getAllMails() {
  const { profile, adminClient } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Admin only');

  const { data, error } = await adminClient
    .from('mails')
    .select('*')
    .order('sent_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ GET MY MAILS ============
export async function getMyMails() {
  const { profile, adminClient } = await requireAuth();

  const { data, error } = await adminClient
    .from('mails')
    .select('*')
    .eq('from_user', profile.id)
    .order('sent_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ DELETE MAIL ============
export async function deleteMail(id: string) {
  const { profile, adminClient } = await requireAuth();

  const { data: mail } = await adminClient
    .from('mails')
    .select('from_user')
    .eq('id', id)
    .maybeSingle();

  if (!mail) throw new Error('Mail not found');
  if (mail.from_user !== profile.id && profile.role !== 'admin') {
    throw new Error('Not authorized');
  }

  const { error } = await adminClient.from('mails').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/mail');
  revalidatePath('/me/mail');
  return { success: true };
}

// ============ GET COMPANY SETTINGS ============
export async function getCompanySettings() {
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Fallback if no row
  return data || {
    id: 1,
    company_name: 'Roster Pro',
    admin_email: null,
    work_start: '09:30',
    work_end: '18:30',
    half_day_hours: 4,
    full_day_hours: 8,
    late_grace_minutes: 15,
    updated_at: new Date().toISOString(),
  };
}

// ============ UPDATE COMPANY SETTINGS ============
export async function updateCompanySettings(input: {
  company_name?: string;
  admin_email?: string;
  work_start?: string;
  work_end?: string;
  half_day_hours?: number;
  full_day_hours?: number;
  late_grace_minutes?: number;
}) {
  const { profile, adminClient } = await requireAdmin();
  if (profile.role !== 'admin') throw new Error('Admin only');

  const update: Record<string, unknown> = {};
  if (input.company_name !== undefined) update.company_name = input.company_name.trim();
  if (input.admin_email !== undefined) update.admin_email = input.admin_email.trim().toLowerCase();
  if (input.work_start !== undefined) update.work_start = input.work_start;
  if (input.work_end !== undefined) update.work_end = input.work_end;
  if (input.half_day_hours !== undefined) update.half_day_hours = input.half_day_hours;
  if (input.full_day_hours !== undefined) update.full_day_hours = input.full_day_hours;
  if (input.late_grace_minutes !== undefined) update.late_grace_minutes = input.late_grace_minutes;

  const { error } = await adminClient
    .from('company_settings')
    .update(update)
    .eq('id', 1);

  if (error) throw new Error(error.message);

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}