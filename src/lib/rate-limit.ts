// ============================================
// RATE LIMITING
// ============================================
// Uses in-memory store by default. For production,
// switch to Upstash Redis (set UPSTASH_REDIS_REST_URL).

import 'server-only';

interface Entry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Entry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  /** Max requests in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Check rate limit for a key (usually IP + action).
 * Returns whether request is allowed.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    retryAfterSeconds: 0,
  };
}

// ============================================
// PRE-CONFIGURED LIMITS
// ============================================
export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowSeconds: 60 }, // 5 attempts/min
  PASSWORD_RESET: { limit: 3, windowSeconds: 300 }, // 3/hour (approx)
  CHECK_IN: { limit: 10, windowSeconds: 60 }, // 10/min
  API_WRITE: { limit: 60, windowSeconds: 60 }, // 60/min
  EMAIL_SEND: { limit: 10, windowSeconds: 300 }, // 10/5min
} as const;

/**
 * Helper: get client IP from headers (server-side).
 */
export async function getClientIp(): Promise<string> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}