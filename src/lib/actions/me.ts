'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.'
    );
  }
  
  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();



  console.log('🔍 Auth check:', {
    hasUser: !!user,
    userId: user?.id,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,   // ← YE ADD KAR
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (!user) throw new Error('Not authenticated');

  const adminClient = getAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

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
    const { error } = await adminClient.from('profiles').update(update).eq('id', user.id);
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
  if (input.newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  // Verify current password by signing in
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: input.current,
  });
  if (signInErr) throw new Error('Current password is incorrect');

  // Update password using admin
  const { error } = await adminClient.auth.admin.updateUserById(user.id, {
    password: input.newPassword,
  });
  if (error) throw new Error(error.message);

  return { success: true };
}

// ============ MY ATTENDANCE (current month) ============
export async function getMyMonthAttendance(month?: string) {
  const { profile, adminClient } = await requireAuth();

  // Get month string (YYYY-MM)
  const m = month || new Date().toISOString().slice(0, 7);

  // ✅ Proper date range calculation
  const [year, mon] = m.split('-').map(Number);
  const start = `${m}-01`;
  
  // Last day of month: new Date(year, month, 0) → previous month's last day
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${m}-${String(lastDay).padStart(2, '0')}`;

  console.log('🔍 fetch attendance:', {
    employeeId: profile.id,
    start,
    end,
  });

  const { data, error } = await adminClient
    .from('attendance')
    .select('*')
    .eq('employee_id', profile.id)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });

  if (error) {
    console.error('❌ Attendance DB error:', error);
    throw new Error('Attendance fetch failed: ' + error.message);
  }

  return data || [];
}

// ============ MAIL (admin) ============
export async function sendMailToAdmin(input: {
  subject: string;
  body: string;
}) {
  const { profile, adminClient } = await requireAuth();

  const { data: settings } = await adminClient
    .from('company_settings')
    .select('admin_email')
    .eq('id', 1)
    .single();

  // For now, just log it (later we can use Resend)
  const { error } = await adminClient.from('mails').insert({
    from_user: profile.id,
    from_name: profile.name,
    to_email: settings?.admin_email || 'admin@rosterpro.com',
    subject: input.subject,
    body: input.body,
  });

  if (error) {
    // If mails table doesn't exist yet, just return success
    console.warn('Mail table not found:', error.message);
    return { success: true, note: 'logged only' };
  }

  return { success: true };
}