'use server';

import { requireAuth, requireAdmin } from './_shared/auth';
import { revalidatePath } from 'next/cache';
import { HALF_LEAVE_DAYS } from '@/lib/constants';
import { logAudit, getRequestMeta } from '@/lib/audit';
import { sendLeaveAppliedEmail, sendLeaveReviewEmail } from '@/lib/email';

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
  if (!input.reason.trim()) throw new Error('Reason is required');

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

  // ✅ Notify admin (fire & forget)
  sendLeaveAppliedEmail({
    employeeName: profile.name,
    employeeEmail: profile.email,
    fromDate: input.from_date,
    toDate: input.to_date,
    days,
    type: input.type,
    reason: input.reason.trim(),
  }).catch((err) => console.error('[leave-email]', err));

  // ✅ Audit
  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'leave.apply',
    entity_type: 'leave',
    entity_id: data?.id,
    new_data: {
      from_date: input.from_date,
      to_date: input.to_date,
      days,
      type: input.type,
    },
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

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
  if (leave.status !== 'Pending')
    throw new Error('Only pending leaves can be cancelled');

  const { error } = await supabase.from('leaves').delete().eq('id', id);
  if (error) throw new Error(error.message);

  // ✅ Audit
  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'leave.cancel',
    entity_type: 'leave',
    entity_id: id,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

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
    .select(
      '*, employee:profiles!leaves_employee_id_fkey(id, name, username, email, dept)'
    )
    .order('applied_at', { ascending: false });

  if (filterStatus && filterStatus !== 'All') {
    query = query.eq('status', filterStatus);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// ============ ADMIN: APPROVE / REJECT ============
export async function reviewLeave(
  id: string,
  status: 'Approved' | 'Rejected'
) {
  const { profile: adminProfile, supabase } = await requireAdmin();

  // Fetch leave + employee for email
  const { data: leaveInfo } = await supabase
    .from('leaves')
    .select(
      'employee_id, from_date, to_date, type, reason, employee:profiles!leaves_employee_id_fkey(name, email)'
    )
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('leaves')
    .update({
      status,
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);

  // Auto-mark attendance if approved
  if (status === 'Approved' && leaveInfo) {
    const start = new Date(leaveInfo.from_date + 'T00:00:00');
    const end = new Date(leaveInfo.to_date + 'T00:00:00');
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }

    const attendanceStatus = leaveInfo.type === 'Half' ? 'Half' : 'Leave';

    for (const date of dates) {
      const { data: existing } = await supabase
        .from('attendance')
        .select('id, check_in')
        .eq('employee_id', leaveInfo.employee_id)
        .eq('date', date)
        .maybeSingle();

      if (existing) {
        if (!existing.check_in) {
          await supabase
            .from('attendance')
            .update({
              status: attendanceStatus,
              notes: `Auto-marked from approved ${leaveInfo.type.toLowerCase()} leave`,
            })
            .eq('id', existing.id);
        }
      } else {
        await supabase.from('attendance').insert({
          employee_id: leaveInfo.employee_id,
          date,
          status: attendanceStatus,
          marked_by: 'admin',
          notes: `Auto-marked from approved ${leaveInfo.type.toLowerCase()} leave`,
        });
      }
    }
  }

  // ✅ Notify employee
  const emp = Array.isArray(leaveInfo?.employee)
    ? leaveInfo?.employee[0]
    : leaveInfo?.employee;
  if (emp && leaveInfo) {
    const days = calculateDays(
      leaveInfo.from_date,
      leaveInfo.to_date,
      leaveInfo.type as 'Full' | 'Half'
    );
    sendLeaveReviewEmail({
      employeeName: emp.name || 'Employee',
      employeeEmail: emp.email || '',
      status,
      fromDate: leaveInfo.from_date,
      toDate: leaveInfo.to_date,
      days,
    }).catch((err) => console.error('[review-email]', err));
  }

  // ✅ Audit
  const meta = await getRequestMeta();
  await logAudit({
    actor_id: adminProfile.id,
    actor_email: adminProfile.email,
    action: `leave.${status.toLowerCase()}`,
    entity_type: 'leave',
    entity_id: id,
    new_data: { status },
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  revalidatePath('/leave');
  revalidatePath('/me/leave');
  revalidatePath('/attendance');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ ADMIN: DELETE ============
export async function deleteLeave(id: string) {
  const { profile: adminProfile, supabase } = await requireAdmin();
  const { error } = await supabase.from('leaves').delete().eq('id', id);
  if (error) throw new Error(error.message);

  const meta = await getRequestMeta();
  await logAudit({
    actor_id: adminProfile.id,
    actor_email: adminProfile.email,
    action: 'leave.delete',
    entity_type: 'leave',
    entity_id: id,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

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

  const meta = await getRequestMeta();
  await logAudit({
    actor_id: adminProfile.id,
    actor_email: adminProfile.email,
    action: 'leave.admin_create',
    entity_type: 'leave',
    entity_id: input.employee_id,
    new_data: input as unknown as Record<string, unknown>,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

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