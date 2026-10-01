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
import { logAudit, getRequestMeta } from '@/lib/audit';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import type { CompanySettings } from '@/types/database';

// ============ SEND MAIL (logged + optional real email) ============
export async function sendMail(input: {
  to_email: string;
  subject: string;
  body: string;
  sendRealEmail?: boolean;
}) {
  const { profile, supabase, user } = await requireAuth();

  // ✅ Rate limit
  const ip = await getClientIp();
  const limit = checkRateLimit(`mail:${user.id}`, RATE_LIMITS.EMAIL_SEND);
  if (!limit.success) {
    throw new Error(
      `Too many emails. Try again in ${limit.retryAfterSeconds}s`
    );
  }

  // Validate
  if (!input.to_email.trim()) throw new Error('Recipient email required');
  if (!input.subject.trim()) throw new Error('Subject required');
  if (!input.body.trim()) throw new Error('Body required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to_email)) {
    throw new Error('Invalid email format');
  }

  const toEmail = input.to_email.trim().toLowerCase();

  // Log in DB
  const { data, error } = await supabase
    .from('mails')
    .insert({
      from_user: profile.id,
      from_name: profile.name,
      to_email: toEmail,
      subject: input.subject.trim(),
      body: input.body.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Optionally send real email
  if (input.sendRealEmail) {
    await sendEmail({
      to: toEmail,
      subject: input.subject.trim(),
      html: `<p>${input.body.replace(/\n/g, '<br>')}</p>`,
      replyTo: profile.email,
    });
  }

  // ✅ Audit
  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'mail.send',
    entity_type: 'mail',
    entity_id: data?.id,
    new_data: { to_email: toEmail, subject: input.subject },
    ip_address: ip,
    user_agent: meta.userAgent,
  });

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
 * ✅ PUBLIC-SAFE settings — NO admin_email exposure.
 * This is what employees see.
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

  // ✅ Fixed: return fallback WITHOUT admin_email
  return data || {
    id: DEFAULT_COMPANY_SETTINGS.id,
    company_name: DEFAULT_COMPANY_SETTINGS.company_name,
    work_start: DEFAULT_COMPANY_SETTINGS.work_start,
    work_end: DEFAULT_COMPANY_SETTINGS.work_end,
    half_day_hours: DEFAULT_COMPANY_SETTINGS.half_day_hours,
    full_day_hours: DEFAULT_COMPANY_SETTINGS.full_day_hours,
    late_grace_minutes: DEFAULT_COMPANY_SETTINGS.late_grace_minutes,
  };
}

/**
 * ✅ ADMIN-ONLY settings — includes admin_email + all fields.
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Merge with defaults to fill missing values
  return (
    (data as CompanySettings) || {
      id: 1,
      company_name: DEFAULT_COMPANY_SETTINGS.company_name,
      admin_email: null,
      work_start: DEFAULT_COMPANY_SETTINGS.work_start,
      work_end: DEFAULT_COMPANY_SETTINGS.work_end,
      half_day_hours: DEFAULT_COMPANY_SETTINGS.half_day_hours,
      full_day_hours: DEFAULT_COMPANY_SETTINGS.full_day_hours,
      late_grace_minutes: DEFAULT_COMPANY_SETTINGS.late_grace_minutes,
      updated_at: new Date().toISOString(),
    }
  );
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
  const { profile, supabase } = await requireAdmin();

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

  // ✅ Audit
  const ip = await getClientIp();
  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'settings.update',
    entity_type: 'settings',
    entity_id: '1',
    new_data: update,
    ip_address: ip,
    user_agent: meta.userAgent,
  });

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}