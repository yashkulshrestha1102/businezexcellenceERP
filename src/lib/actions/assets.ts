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
    .select('id, role, name')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Profile not found');
  return { user, profile, adminClient };
}

async function requireAdmin() {
  const ctx = await requireAuth();
  if (ctx.profile.role !== 'admin') throw new Error('Admin only');
  return ctx;
}

export async function getAllAssets() {
  await requireAdmin();
  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('assets')
    .select('*, assigned_employee:profiles!assets_assigned_to_fkey(id, name, username)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getMyAssets() {
  const { profile, adminClient } = await requireAuth();

  const { data, error } = await adminClient
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
  await requireAdmin();
  const adminClient = getAdminClient();

  if (!input.name.trim()) throw new Error('Asset name required');

  const { error } = await adminClient.from('assets').insert({
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
  await requireAdmin();
  const adminClient = getAdminClient();

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

  const { error } = await adminClient.from('assets').update(update).eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/assets');
  revalidatePath('/me/assets');
  return { success: true };
}

export async function deleteAsset(id: string) {
  await requireAdmin();
  const adminClient = getAdminClient();

  const { error } = await adminClient.from('assets').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/assets');
  revalidatePath('/me/assets');
  return { success: true };
}

export async function getAssetStats() {
  await requireAdmin();
  const adminClient = getAdminClient();

  const { data } = await adminClient.from('assets').select('status');
  const total = data?.length || 0;
  const assigned = (data || []).filter((a) => a.status === 'Assigned').length;
  const available = (data || []).filter((a) => a.status === 'Available').length;
  const maintenance = (data || []).filter((a) => a.status === 'Maintenance').length;

  return { total, assigned, available, maintenance };
}