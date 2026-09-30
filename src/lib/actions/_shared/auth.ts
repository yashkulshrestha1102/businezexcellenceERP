import { createClient } from '@/lib/supabase/server';
import {
  createClient as createAdminClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

/**
 * User-scoped Supabase client (RLS enforced).
 */
export async function createUserClient() {
  return await createClient();
}

/**
 * Service-role client. ONLY for auth.admin.* and cross-user admin ops.
 * NEVER expose to client components.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  return createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface AuthContext {
  user: { id: string; email: string };
  profile: Profile;
  supabase: SupabaseClient;
  serviceClient: SupabaseClient;
}

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createUserClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError)
    throw new Error('Profile fetch failed: ' + profileError.message);
  if (!profile) throw new Error('Profile not found');
  if (!profile.is_active) throw new Error('Account is inactive');

  return {
    user: { id: user.id, email: user.email || '' },
    profile: profile as Profile,
    supabase,
    serviceClient: createServiceClient(),
  };
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.profile.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return ctx;
}