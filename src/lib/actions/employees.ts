'use server';

import { requireAdmin, createServiceClient } from './_shared/auth';
import { revalidatePath } from 'next/cache';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

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
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============ CREATE (needs service role for auth.admin) ============
export async function createEmployee(input: EmployeeInput) {
  await requireAdmin(); // ✅ Auth check
  const adminClient = createServiceClient(); // ✅ Service role for auth.admin only

  if (!input.name || !input.username || !input.email || !input.password) {
    throw new Error('Name, username, email, and password are required');
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

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
  const { user, supabase } = await requireAdmin();
  const adminClient = createServiceClient();

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

  if (input.password && input.password.length >= MIN_PASSWORD_LENGTH) {
    const { error: pwError } = await adminClient.auth.admin.updateUserById(id, {
      password: input.password,
    });
    if (pwError) throw new Error(pwError.message);
  }

  if (input.email) {
    const { error: emailError } = await adminClient.auth.admin.updateUserById(id, {
      email: input.email.trim().toLowerCase(),
      email_confirm: true,
    });
    if (emailError) throw new Error(emailError.message);
  }

  const { error } = await supabase
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
  const { user } = await requireAdmin();
  const adminClient = createServiceClient();

  if (user.id === id) throw new Error('You cannot delete your own account');

  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  revalidatePath('/employees');
  revalidatePath('/dashboard');
  return { success: true };
}

// ============ GET SINGLE ============
export async function getEmployee(id: string) {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}