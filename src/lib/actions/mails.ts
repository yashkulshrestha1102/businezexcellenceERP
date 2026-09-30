'use server';

import {
  requireAuth,
  requireAdmin,
  createUserClient,
} from './_shared/auth';
import { revalidatePath } from 'next/cache';
import {
  PUBLIC_COMPANY_SETTINGS_FIELDS,
  DEFAULT_COMPANY_SETTINGS,
} from '@/lib/constants';
import type { CompanySettings } from '@/types/database';

// ============ SEND MAIL ============
export async function sendMail(input: {
  to_email: string;
  subject: string;
  body: string;
}) {
  const { profile, supabase } = await requireAuth();

  if (!input.to_email.trim()) throw new Error('Recipient email required');
  if (!input.subject.trim()) throw new Error('Subject required');
  if (!input.body.trim()) throw new Error('Body required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to_email)) {
    throw new Error('Invalid email format');
  }

  const { data, error } = await supabase
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

// ============ GET ALL MAILS (Admin only) ============
export async function getAllMails() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('mails')
    .select('*')
    .order('sent_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ GET MY MAILS ============
export async function getMyMails() {
  const { profile, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from('mails')
    .select('*')
    .eq('from_user', profile.id)
    .order('sent_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ DELETE MAIL ============
export async function deleteMail(id: string) {
  const { profile, supabase } = await requireAuth();

  const { data: mail } = await supabase
    .from('mails')
    .select('from_user')
    .eq('id', id)
    .maybeSingle();

  if (!mail) throw new Error('Mail not found');
  if (mail.from_user !== profile.id && profile.role !== 'admin') {
    throw new Error('Not authorized');
  }

  const { error } = await supabase.from('mails').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/mail');
  revalidatePath('/me/mail');
  return { success: true };
}

// ============================================================
// COMPANY SETTINGS
// ============================================================

/**
 * ✅ PUBLIC-SAFE settings — no admin_email exposure.
 * Use this for: useCompanySettings hook, dashboard display, attendance calculations.
 */
export async function getPublicCompanySettings() {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('company_settings')
    .select(PUBLIC_COMPANY_SETTINGS_FIELDS)
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data || DEFAULT_COMPANY_SETTINGS;
}

/**
 * ✅ ADMIN-ONLY settings — includes admin_email + all fields.
 * Use this for: settings page, mail compose default recipient.
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (data as CompanySettings) || DEFAULT_COMPANY_SETTINGS;
}

// ============ UPDATE COMPANY SETTINGS (Admin only) ============
export async function updateCompanySettings(input: {
  company_name?: string;
  admin_email?: string;
  work_start?: string;
  work_end?: string;
  half_day_hours?: number;
  full_day_hours?: number;
  late_grace_minutes?: number;
}) {
  const { supabase } = await requireAdmin();

  const update: Record<string, unknown> = {};
  if (input.company_name !== undefined)
    update.company_name = input.company_name.trim();
  if (input.admin_email !== undefined)
    update.admin_email = input.admin_email.trim().toLowerCase();
  if (input.work_start !== undefined) update.work_start = input.work_start;
  if (input.work_end !== undefined) update.work_end = input.work_end;
  if (input.half_day_hours !== undefined)
    update.half_day_hours = input.half_day_hours;
  if (input.full_day_hours !== undefined)
    update.full_day_hours = input.full_day_hours;
  if (input.late_grace_minutes !== undefined)
    update.late_grace_minutes = input.late_grace_minutes;

  const { error } = await supabase
    .from('company_settings')
    .update(update)
    .eq('id', 1);

  if (error) throw new Error(error.message);

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}