'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const adminClient = getAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role, name, email')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Profile not found');
  return { user, profile, adminClient };
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

// ============ GET ALL MAILS (ADMIN) ============
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
    .single();

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
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============ UPDATE COMPANY SETTINGS (ADMIN) ============
export async function updateCompanySettings(input: {
  company_name?: string;
  admin_email?: string;
  work_start?: string;
}) {
  const { profile, adminClient } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Admin only');

  const update: Record<string, unknown> = {};
  if (input.company_name) update.company_name = input.company_name.trim();
  if (input.admin_email) update.admin_email = input.admin_email.trim().toLowerCase();
  if (input.work_start) update.work_start = input.work_start;

  const { error } = await adminClient
    .from('company_settings')
    .update(update)
    .eq('id', 1);

  if (error) throw new Error(error.message);

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}