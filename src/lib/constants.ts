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




// ============================================
// Company Settings
// ============================================
export const PUBLIC_COMPANY_SETTINGS_FIELDS =
  'id, company_name,admin_email, work_start, work_end, half_day_hours, full_day_hours, late_grace_minutes' as const;

export const DEFAULT_COMPANY_SETTINGS = {
  id: 1,
  company_name: 'Roster Pro',
  admin_email: null,
  work_start: DEFAULT_WORK_START,
  work_end: DEFAULT_WORK_END,
  half_day_hours: DEFAULT_HALF_DAY_HOURS,
  full_day_hours: DEFAULT_FULL_DAY_HOURS,
  late_grace_minutes: DEFAULT_LATE_GRACE_MINUTES,
  updated_at: new Date().toISOString(),
} as const;




// ============================================
// Error Messages (centralized for consistency)
// ============================================
export const ERROR_MESSAGES = {
  // Auth
  NOT_AUTHENTICATED: 'You must be logged in to continue',
  NOT_ADMIN: 'Admin access required',
  ACCOUNT_INACTIVE: 'Your account has been deactivated',
  PROFILE_NOT_FOUND: 'Profile not found. Contact admin.',

  // Attendance
  ALREADY_CHECKED_IN: 'You have already checked in today',
  ALREADY_CHECKED_OUT: 'You have already checked out today',
  MUST_CHECK_IN_FIRST: 'Please check in first before checking out',
  ON_APPROVED_LEAVE: 'You have an approved leave today. No check-in needed.',
  DUPLICATE_ATTENDANCE: 'Attendance already recorded for this date',

  // Leave
  INVALID_DATE_RANGE: 'End date cannot be before start date',
  LEAVE_REASON_REQUIRED: 'Please provide a reason for leave',
  LEAVE_NOT_PENDING: 'Only pending leaves can be modified',
  NOT_YOUR_LEAVE: 'You can only modify your own leave requests',

  // Employees
  EMPLOYEE_NOT_FOUND: 'Employee not found',
  DUPLICATE_USERNAME: 'This username is already taken',
  DUPLICATE_EMAIL: 'This email is already registered',
  PASSWORD_TOO_SHORT: `Password must be at least 6 characters`,
  CANNOT_DELETE_SELF: 'You cannot delete your own account',
  CANNOT_REMOVE_OWN_ADMIN: 'You cannot remove your own admin role',

  // Assets
  ASSET_NAME_REQUIRED: 'Asset name is required',
  ASSET_NOT_FOUND: 'Asset not found',

  // Mail
  INVALID_EMAIL: 'Please enter a valid email address',
  EMAIL_REQUIRED: 'Email address is required',
  SUBJECT_REQUIRED: 'Subject is required',
  BODY_REQUIRED: 'Message body is required',

  // Generic
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
} as const;