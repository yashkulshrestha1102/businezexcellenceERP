// ============================================
// ENVIRONMENT VALIDATION
// ============================================
// Ye file app startup pe env vars validate karti hai.
// Agar koi env missing/malformed hai toh build fail ho jayega
// instead of runtime crash.

import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'Supabase anon key too short'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, 'Supabase service role key too short'),

  // App
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_COMPANY_NAME: z
    .string()
    .default('Businezexcellence StartX LLP'),
  NEXT_PUBLIC_COMPANY_SHORT_NAME: z
    .string()
    .default('Businezexcellence'),

  // Email (optional in dev — warnings only)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional(),

  // Rate limiting (optional)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Runtime
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

// ============================================
// SERVER-ONLY ENV (includes secrets)
// ============================================
function validateServerEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:\n',
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
    );
    throw new Error('Invalid environment variables. Check .env.local');
  }

  // Warnings for missing email config
  if (!parsed.data.RESEND_API_KEY && parsed.data.NODE_ENV === 'production') {
    console.warn(
      '⚠️  RESEND_API_KEY missing in production — emails will not be sent'
    );
  }

  return parsed.data;
}

// ============================================
// CLIENT-SAFE ENV (only NEXT_PUBLIC_*)
// ============================================
export const env = {
  // Server-side secrets (undefined on client)
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,

  // Public (safe on client)
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  NEXT_PUBLIC_COMPANY_NAME:
    process.env.NEXT_PUBLIC_COMPANY_NAME || 'Businezexcellence StartX LLP',
  NEXT_PUBLIC_COMPANY_SHORT_NAME:
    process.env.NEXT_PUBLIC_COMPANY_SHORT_NAME || 'Businezexcellence',

  // Email
  RESEND_FROM_EMAIL:
    process.env.RESEND_FROM_EMAIL || 'noreply@businezexcellence.com',
  RESEND_FROM_NAME:
    process.env.RESEND_FROM_NAME || 'Businezexcellence StartX LLP',
  ADMIN_NOTIFICATION_EMAIL:
    process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@businezexcellence.com',

  // Runtime
  NODE_ENV: (process.env.NODE_ENV || 'development') as
    | 'development'
    | 'production'
    | 'test',
} as const;

// ============================================
// SERVER VALIDATION (call this in server-only files)
// ============================================
export function assertServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('assertServerEnv() can only be called on the server');
  }
  return validateServerEnv();
}