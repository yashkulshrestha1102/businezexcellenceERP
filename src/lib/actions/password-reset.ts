'use server';

import { createClient } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/constants';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export async function sendPasswordResetEmail(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address');
  }

  // ✅ Rate limit by IP
  const ip = await getClientIp();
  const limit = checkRateLimit(
    `pwreset:${ip}`,
    RATE_LIMITS.PASSWORD_RESET
  );
  if (!limit.success) {
    throw new Error(
      `Too many reset attempts. Try again in ${limit.retryAfterSeconds}s`
    );
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