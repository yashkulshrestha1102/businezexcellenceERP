import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  createClient as createAdminClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import { env } from '@/lib/env';
import { ERROR_MESSAGES } from '@/lib/constants';

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
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  return createAdminClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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
    throw new Error(ERROR_MESSAGES.NOT_AUTHENTICATED);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('Profile fetch failed: ' + profileError.message);
  }
  if (!profile) throw new Error(ERROR_MESSAGES.PROFILE_NOT_FOUND);
  if (!profile.is_active) throw new Error(ERROR_MESSAGES.ACCOUNT_INACTIVE);

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
    throw new Error(ERROR_MESSAGES.NOT_ADMIN);
  }
  return ctx;
}