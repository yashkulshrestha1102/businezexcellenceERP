// ============================================
// AUDIT LOG HELPER
// ============================================
// Server-side only. Uses service role to write logs.
// NEVER import this in client components.

import 'server-only';
import { createServiceClient } from '@/lib/actions/_shared/auth';

export interface AuditEntry {
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

/**
 * Write an audit log entry.
 * Fails silently (logs to console) so it never breaks the main flow.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: entry.actor_id,
      actor_email: entry.actor_email,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      old_data: entry.old_data || null,
      new_data: entry.new_data || null,
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || null,
    });

    if (error) {
      console.error('[audit] Failed to write log:', error.message);
    }
  } catch (err) {
    console.error('[audit] Unexpected error:', err);
  }
}

/**
 * Extract request metadata from headers (for audit).
 */
export async function getRequestMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    return {
      ip:
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        null,
      userAgent: h.get('user-agent') || null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}