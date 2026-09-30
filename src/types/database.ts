// ============================================
// ROSTER PRO — Database Types
// ============================================
// Row types are auto-generated from Supabase.
// Regenerate with:
//   npx supabase gen types typescript --project-id <ID> --schema public > src/types/supabase.ts
//
// Manual enum types (not DB enums, just CHECK constraints) are kept below.

import type { Database } from './supabase';

// ============ AUTO-GENERATED TABLE ROW TYPES ============
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Attendance = Database['public']['Tables']['attendance']['Row'];
export type Leave = Database['public']['Tables']['leaves']['Row'];
export type Asset = Database['public']['Tables']['assets']['Row'];
export type CompanySettings =
  Database['public']['Tables']['company_settings']['Row'];
export type Mail = Database['public']['Tables']['mails']['Row'];

// ============ INSERT TYPES ============
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type AttendanceInsert = Database['public']['Tables']['attendance']['Insert'];
export type LeaveInsert = Database['public']['Tables']['leaves']['Insert'];
export type AssetInsert = Database['public']['Tables']['assets']['Insert'];
export type MailInsert = Database['public']['Tables']['mails']['Insert'];

// ============ MANUAL ENUM TYPES ============
// These are DB CHECK constraints, not actual PostgreSQL enums.
export type UserRole = 'admin' | 'employee';
export type AttendanceStatus = 'Present' | 'Half' | 'Leave' | 'Absent';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeaveType = 'Full' | 'Half';
export type AssetStatus = 'Available' | 'Assigned' | 'Maintenance' | 'Retired';
export type MarkedBy = 'self' | 'admin';

// ============ RE-EXPORTS ============
export type { Database };