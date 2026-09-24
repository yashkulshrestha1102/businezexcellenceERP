// ============================================
// ROSTER PRO — App Constants
// ============================================

export const APP_NAME = 'Roster Pro';
export const APP_DESCRIPTION = 'Employee & Attendance Management';
export const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const USER_ROLES = ['admin', 'employee'] as const;
export const ATTENDANCE_STATUSES = ['Present', 'Half', 'Leave', 'Absent'] as const;
export const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export const LEAVE_TYPES = ['Full', 'Half'] as const;
export const ASSET_STATUSES = ['Available', 'Assigned', 'Maintenance', 'Retired'] as const;

export const ASSET_TYPES = [
  'Laptop',
  'Phone',
  'Tablet',
  'Monitor',
  'Accessory',
  'Furniture',
  'Other',
] as const;

// Business defaults (can be overridden by company_settings)
export const DEFAULT_WORK_START = '09:30';
export const DEFAULT_WORK_END = '18:30';
export const DEFAULT_HALF_DAY_HOURS = 4;
export const DEFAULT_FULL_DAY_HOURS = 8;
export const DEFAULT_LATE_GRACE_MINUTES = 15;

export const HALF_LEAVE_DAYS = 0.5;
export const MIN_PASSWORD_LENGTH = 6;

// Storage keys
export const STORAGE_KEYS = {
  TODAY_ATTENDANCE: 'roster-today-attendance',
  COMPANY_SETTINGS: 'roster-company-settings',
  AUTH_CACHE: 'roster-auth-cache',
} as const;

// Date / timezone
export const TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 330; // UTC+5:30