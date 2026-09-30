'use server';

import { createClient } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/constants';

export async function sendPasswordResetEmail(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address');
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${APP_URL}/reset-password`,
    }
  );

  if (error) throw new Error(error.message);

  return { success: true };
}