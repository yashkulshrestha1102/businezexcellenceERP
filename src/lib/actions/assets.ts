'use server';

import { requireAuth, requireAdmin } from './_shared/auth';
import { revalidatePath } from 'next/cache';

export async function getAllAssets() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('assets')
    .select('*, assigned_employee:profiles!assets_assigned_to_fkey(id, name, username)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getMyAssets() {
  const { profile, supabase } = await requireAuth();

  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('assigned_to', profile.id)
    .order('assigned_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createAsset(input: {
  name: string;
  type: string;
  serial: string;
  assigned_to: string | null;
  notes?: string;
}) {
  const { supabase } = await requireAdmin();

  if (!input.name.trim()) throw new Error('Asset name required');

  const { error } = await supabase.from('assets').insert({
    name: input.name.trim(),
    type: input.type || 'Other',
    serial: input.serial || '',
    assigned_to: input.assigned_to || null,
    status: input.assigned_to ? 'Assigned' : 'Available',
    assigned_at: input.assigned_to ? new Date().toISOString() : null,
    notes: input.notes || '',
  });

  if (error) throw new Error(error.message);

  revalidatePath('/assets');
  revalidatePath('/me/assets');
  return { success: true };
}

export async function updateAsset(
  id: string,
  input: {
    name?: string;
    type?: string;
    serial?: string;
    assigned_to?: string | null;
    status?: 'Available' | 'Assigned' | 'Maintenance' | 'Retired';
    notes?: string;
  }
) {
  const { supabase } = await requireAdmin();

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.type !== undefined) update.type = input.type;
  if (input.serial !== undefined) update.serial = input.serial;
  if (input.notes !== undefined) update.notes = input.notes;

  if (input.assigned_to !== undefined) {
    update.assigned_to = input.assigned_to || null;
    if (input.assigned_to) {
      update.status = 'Assigned';
      update.assigned_at = new Date().toISOString();
      update.returned_at = null;
    } else {
      update.status = 'Available';
      update.returned_at = new Date().toISOString();
    }
  }
  if (input.status) update.status = input.status;

  const { error } = await supabase.from('assets').update(update).eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/assets');
  revalidatePath('/me/assets');
  return { success: true };
}

export async function deleteAsset(id: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/assets');
  revalidatePath('/me/assets');
  return { success: true };
}

export async function getAssetStats() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase.from('assets').select('status');
  const total = data?.length || 0;
  const assigned = (data || []).filter((a) => a.status === 'Assigned').length;
  const available = (data || []).filter((a) => a.status === 'Available').length;
  const maintenance = (data || []).filter((a) => a.status === 'Maintenance').length;

  return { total, assigned, available, maintenance };
}