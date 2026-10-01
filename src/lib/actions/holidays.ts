'use server';

import { requireAuth, requireAdmin } from './_shared/auth';
import { revalidatePath } from 'next/cache';
import { logAudit, getRequestMeta } from '@/lib/audit';

// ============================================
// HOLIDAYS
// ============================================

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'Public' | 'Optional' | 'Company';
  description: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export async function getHolidaysByYear(year: number): Promise<Holiday[]> {
  const { supabase } = await requireAuth();

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as Holiday[];
}

export async function getHolidaysByRange(
  fromDate: string,
  toDate: string
): Promise<Holiday[]> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as Holiday[];
}

export async function getUpcomingHolidays(limit = 5): Promise<Holiday[]> {
  const { supabase } = await requireAuth();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as Holiday[];
}

export async function createHoliday(input: {
  name: string;
  date: string;
  type: 'Public' | 'Optional' | 'Company';
  description?: string;
}): Promise<Holiday> {
  const { profile, supabase } = await requireAdmin();

  if (!input.name.trim()) throw new Error('Holiday name required');
  if (!input.date) throw new Error('Date required');

  const { data, error } = await supabase
    .from('holidays')
    .insert({
      name: input.name.trim(),
      date: input.date,
      type: input.type,
      description: input.description?.trim() || null,
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Holiday already exists for this date');
    }
    throw new Error(error.message);
  }

  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'holiday.create',
    entity_type: 'holiday',
    entity_id: data.id,
    new_data: { name: input.name, date: input.date },
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  revalidatePath('/holidays');
  revalidatePath('/dashboard');
  return data as Holiday;
}

export async function updateHoliday(
  id: string,
  input: {
    name?: string;
    date?: string;
    type?: 'Public' | 'Optional' | 'Company';
    description?: string;
  }
): Promise<{ success: boolean }> {
  const { profile, supabase } = await requireAdmin();

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.date !== undefined) update.date = input.date;
  if (input.type !== undefined) update.type = input.type;
  if (input.description !== undefined)
    update.description = input.description.trim() || null;

  const { error } = await supabase
    .from('holidays')
    .update(update)
    .eq('id', id);

  if (error) throw new Error(error.message);

  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'holiday.update',
    entity_type: 'holiday',
    entity_id: id,
    new_data: update,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  revalidatePath('/holidays');
  return { success: true };
}

export async function deleteHoliday(id: string): Promise<{ success: boolean }> {
  const { profile, supabase } = await requireAdmin();

  const { error } = await supabase.from('holidays').delete().eq('id', id);
  if (error) throw new Error(error.message);

  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'holiday.delete',
    entity_type: 'holiday',
    entity_id: id,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  revalidatePath('/holidays');
  return { success: true };
}

// ============================================
// WEEK-OFFS
// ============================================

export interface WeekOff {
  id: string;
  day_of_week: number;
  is_active: boolean;
}

export async function getWeekOffs(): Promise<WeekOff[]> {
  const { supabase } = await requireAuth();

  const { data, error } = await supabase
    .from('week_offs')
    .select('*')
    .order('day_of_week');

  if (error) throw new Error(error.message);
  return (data || []) as WeekOff[];
}

export async function updateWeekOffs(
  weekOffs: { day_of_week: number; is_active: boolean }[]
): Promise<{ success: boolean }> {
  const { profile, supabase } = await requireAdmin();

  for (const wo of weekOffs) {
    const { error } = await supabase
      .from('week_offs')
      .upsert(
        {
          day_of_week: wo.day_of_week,
          is_active: wo.is_active,
        },
        { onConflict: 'day_of_week' }
      );
    if (error) throw new Error(error.message);
  }

  const meta = await getRequestMeta();
  await logAudit({
    actor_id: profile.id,
    actor_email: profile.email,
    action: 'weekoff.update',
    entity_type: 'weekoff',
    new_data: { weekOffs },
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  revalidatePath('/holidays');
  revalidatePath('/dashboard');
  return { success: true };
}