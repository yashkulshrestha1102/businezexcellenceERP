'use server';

import { requireAuth, requireAdmin } from './_shared/auth';
import { revalidatePath } from 'next/cache';
import { HALF_LEAVE_DAYS } from '@/lib/constants';

function calculateDays(from: string, to: string, type: 'Full' | 'Half'): number {
  if (type === 'Half') return HALF_LEAVE_DAYS;
  const d1 = new Date(from + 'T00:00:00');
  const d2 = new Date(to + 'T00:00:00');
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

// ============ EMPLOYEE: APPLY LEAVE ============
export async function applyLeave(input: {
  from_date: string;
  to_date: string;
  type: 'Full' | 'Half';
  reason: string;
}) {
  const { profile, supabase } = await requireAuth();

  if (!input.from_date || !input.to_date) {
    throw new Error('From and To dates are required');
  }
  if (input.to_date < input.from_date) {
    throw new Error('To date cannot be before From date');
  }
  if (!input.reason.trim()) {
    throw new Error('Reason is required');
  }

  const days = calculateDays(input.from_date, input.to_date, input.type);

  const { data, error } = await supabase
    .from('leaves')
    .insert({
      employee_id: profile.id,
      from_date: input.from_date,
      to_date: input.to_date,
      type: input.type,
      days,
      reason: input.reason.trim(),
      status: 'Pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/leave');
  revalidatePath('/me/leave');
  revalidatePath('/dashboard');

  return data;
}

// ============ EMPLOYEE: CANCEL ============
export async function cancelMyLeave(id: string) {
  const { profile, supabase } = await requireAuth();

  const { data: leave } = await supabase
    .from('leaves')
    .select('employee_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!leave) throw new Error('Leave not found');
  if (leave.employee_id !== profile.id) throw new Error('Not your leave');
  if (leave.status !== 'Pending') throw new Error('Only pending leaves can be cancelled');

  const { error } = await supabase.from('leaves').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/me/leave');
  revalidatePath('/leave');
  return { success: true };
}

// ============ GET MY LEAVES ============
export async function getMyLeaves() {
  const { profile, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', profile.id)
    .order('applied_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ ADMIN: ALL LEAVES ============
export async function getAllLeaves(filterStatus?: string) {
  const { supabase } = await requireAdmin();

  let query = supabase
    .from('leaves')
    .select('*, employee:profiles!leaves_employee_id_fkey(id, name, username, dept)')
    .order('applied_at', { ascending: false });

  if (filterStatus && filterStatus !== 'All') {
    query = query.eq('status', filterStatus);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// ============ ADMIN: APPROVE / REJECT (Bug Fixed ✅) ============
export async function reviewLeave(id: string, status: 'Approved' | 'Rejected') {
  const { profile: adminProfile, supabase } = await requireAdmin();

  const { error } = await supabase
    .from('leaves')
    .update({
      status,
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  if (status === 'Approved') {
    const { data: leave } = await supabase
      .from('leaves')
      .select('employee_id, from_date, to_date, type')
      .eq('id', id)
      .maybeSingle();

    if (leave && leave.type === 'Full') {
      const start = new Date(leave.from_date + 'T00:00:00');
      const end = new Date(leave.to_date + 'T00:00:00');
      const dates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
      }

      for (const date of dates) {
        const { data: existing } = await supabase
          .from('attendance')
          .select('id, check_in') // ✅ Check check_in bhi
          .eq('employee_id', leave.employee_id)
          .eq('date', date)
          .maybeSingle();

        // ✅ FIX: Agar user ne already check-in kar liya tha, override na karo
        if (existing) {
          if (!existing.check_in) {
            await supabase
              .from('attendance')
              .update({ status: 'Leave' })
              .eq('id', existing.id);
          }
          // else: check-in already hai — leave mark na karo
        } else {
          await supabase.from('attendance').insert({
            employee_id: leave.employee_id,
            date,
            status: 'Leave',
            marked_by: 'admin',
            notes: 'Auto-marked from approved leave',
          });
        }
      }
    }
  }

  revalidatePath('/leave');
  revalidatePath('/me/leave');
  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ ADMIN: DELETE ============
export async function deleteLeave(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('leaves').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/leave');
  revalidatePath('/me/leave');
  return { success: true };
}

// ============ ADMIN: LOG LEAVE ============
export async function adminCreateLeave(input: {
  employee_id: string;
  from_date: string;
  to_date: string;
  type: 'Full' | 'Half';
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}) {
  const { profile: adminProfile, supabase } = await requireAdmin();

  const days = calculateDays(input.from_date, input.to_date, input.type);

  const { error } = await supabase.from('leaves').insert({
    employee_id: input.employee_id,
    from_date: input.from_date,
    to_date: input.to_date,
    type: input.type,
    days,
    reason: input.reason.trim(),
    status: input.status,
    reviewed_by: adminProfile.id,
    reviewed_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidatePath('/leave');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ STATS ============
export async function getLeaveStats() {
  const { supabase } = await requireAdmin();

  const { data: all } = await supabase.from('leaves').select('status, days');

  const pending = (all || []).filter((l) => l.status === 'Pending').length;
  const approved = (all || []).filter((l) => l.status === 'Approved').length;
  const rejected = (all || []).filter((l) => l.status === 'Rejected').length;
  const totalDays = (all || [])
    .filter((l) => l.status === 'Approved')
    .reduce((sum, l) => sum + Number(l.days || 0), 0);

  return { pending, approved, rejected, totalDays };
}

// ============ MY LEAVE BALANCE ============
export async function getMyLeaveBalance() {
  const { profile, supabase } = await requireAuth();

  const { data: leaves } = await supabase
    .from('leaves')
    .select('days, status')
    .eq('employee_id', profile.id);

  const approved = (leaves || [])
    .filter((l) => l.status === 'Approved')
    .reduce((sum, l) => sum + Number(l.days || 0), 0);
  const pending = (leaves || [])
    .filter((l) => l.status === 'Pending')
    .reduce((sum, l) => sum + Number(l.days || 0), 0);

  return { approved, pending };
}