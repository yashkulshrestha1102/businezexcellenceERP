'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Admin client — service_role key use karta hai (RLS bypass)
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper: Get current user's role using admin client (bypasses RLS)
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  console.log('🔍 DEBUG - auth user:', {
    id: user?.id,
    email: user?.email,
    authError: authError?.message,
  });

  if (!user) throw new Error('Not authenticated');

  const adminClient = getAdminClient();

  // Fetch profile using admin client (RLS bypass)
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, is_active, name, email')
    .eq('id', user.id)
    .maybeSingle();  // ← maybeSingle instead of single

  console.log('🔍 DEBUG - profile fetch:', {
    profile,
    profileError: profileError?.message,
    userId: user.id,
  });

  if (profileError) {
    throw new Error('Profile fetch failed: ' + profileError.message);
  }

  if (!profile) {
    throw new Error(
      'No profile found for your account. Please check Supabase profiles table.'
    );
  }

  if (profile.role !== 'admin') {
    throw new Error(
      `Only admin can do this. Your role is: "${profile.role}"`
    );
  }

  if (!profile.is_active) {
    throw new Error('Your account is inactive');
  }

  return { user, adminClient };
}

interface EmployeeInput {
  name: string;
  username: string;
  password?: string;
  email: string;
  phone?: string;
  dept?: string;
  designation?: string;
  salary?: number;
  join_date?: string;
  role?: 'admin' | 'employee';
}

// ============ LIST ============
export async function getEmployees() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

// ============ CREATE ============
export async function createEmployee(input: EmployeeInput) {
  const { adminClient } = await requireAdmin();

  // Validate
  if (!input.name || !input.username || !input.email || !input.password) {
    throw new Error('Name, username, email, and password are required');
  }
  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      username: input.username.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role || 'employee',
    },
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Failed to create user');

  // Update profile with extra fields
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      username: input.username.trim().toLowerCase(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone || '',
      dept: input.dept || '',
      designation: input.designation || '',
      salary: input.salary || 0,
      join_date: input.join_date || new Date().toISOString().slice(0, 10),
      role: input.role || 'employee',
      is_active: true,
    })
    .eq('id', authData.user.id);

  if (updateError) {
    await adminClient.auth.admin.deleteUser(authData.user.id);
    throw new Error(updateError.message);
  }

  revalidatePath('/employees');
  revalidatePath('/dashboard');
  return { success: true, id: authData.user.id };
}

// ============ UPDATE ============
export async function updateEmployee(id: string, input: Partial<EmployeeInput>) {
  const { user, adminClient } = await requireAdmin();

  // Prevent removing own admin role
  if (id === user.id && input.role && input.role !== 'admin') {
    throw new Error('You cannot remove your own admin role');
  }

  const updateData: Record<string, unknown> = {};
  if (input.name) updateData.name = input.name.trim();
  if (input.username) updateData.username = input.username.trim().toLowerCase();
  if (input.email) updateData.email = input.email.trim().toLowerCase();
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.dept !== undefined) updateData.dept = input.dept;
  if (input.designation !== undefined) updateData.designation = input.designation;
  if (input.salary !== undefined) updateData.salary = input.salary;
  if (input.join_date) updateData.join_date = input.join_date;
  if (input.role) updateData.role = input.role;

  // If password provided, update auth password
  if (input.password && input.password.length >= 6) {
    const { error: pwError } = await adminClient.auth.admin.updateUserById(id, {
      password: input.password,
    });
    if (pwError) throw new Error(pwError.message);
  }

  // If email changed, update auth email
  if (input.email) {
    const { error: emailError } = await adminClient.auth.admin.updateUserById(id, {
      email: input.email.trim().toLowerCase(),
      email_confirm: true,
    });
    if (emailError) throw new Error(emailError.message);
  }

  // Update profile
  const { error } = await adminClient
    .from('profiles')
    .update(updateData)
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/employees');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ DELETE ============
export async function deleteEmployee(id: string) {
  const { user, adminClient } = await requireAdmin();

  if (user.id === id) {
    throw new Error('You cannot delete your own account');
  }

  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  revalidatePath('/employees');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ GET SINGLE ============
export async function getEmployee(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}