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






// ============================================
// PHASE 2: HOLIDAYS
// ============================================
export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'Public' | 'Optional' | 'Company';
  description: string | null;
  is_recurring: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeekOff {
  id: string;
  day_of_week: number;
  is_active: boolean;
  updated_at: string;
}