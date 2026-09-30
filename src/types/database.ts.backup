// ============================================
// ROSTER PRO — Database Types
// ============================================

export type UserRole = 'admin' | 'employee';
export type AttendanceStatus = 'Present' | 'Half' | 'Leave' | 'Absent';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeaveType = 'Full' | 'Half';
export type AssetStatus = 'Available' | 'Assigned' | 'Maintenance' | 'Retired';
export type MarkedBy = 'self' | 'admin';

export interface Profile {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  dept: string | null;
  designation: string | null;
  join_date: string | null;
  salary: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  late: boolean;
  short_day: boolean;
  hours: number;
  marked_by: MarkedBy;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
  employee_id: string;
  from_date: string;
  to_date: string;
  type: LeaveType;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  applied_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  serial: string | null;
  assigned_to: string | null;
  status: AssetStatus;
  assigned_at: string | null;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  admin_email: string | null;
  work_start: string;
  work_end: string;
  half_day_hours: number;
  full_day_hours: number;
  late_grace_minutes: number;
  updated_at: string;
}

export interface Mail {
  id: string;
  from_user: string | null;
  from_name: string | null;
  to_email: string;
  subject: string;
  body: string;
  sent_at: string;
}