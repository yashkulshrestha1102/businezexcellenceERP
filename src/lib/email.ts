// ============================================
// EMAIL SYSTEM (Resend)
// ============================================
// Server-side only. Sends transactional emails.

import 'server-only';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { APP_NAME } from '@/lib/constants';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — emails disabled');
    return null;
  }
  if (!_resend) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

// ============================================
// BASE EMAIL WRAPPER
// ============================================
function wrapHtml(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f6fbfa; margin: 0; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0f3d38, #0d9488); color: #fff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 28px 24px; color: #0f172a; line-height: 1.6; font-size: 14px; }
    .footer { background: #f0fdfa; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
    .btn { display: inline-block; background: #0d9488; color: #fff !important; padding: 11px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .box { background: #f0fdfa; border-left: 3px solid #0d9488; padding: 12px 16px; border-radius: 6px; margin: 14px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME}</h1>
    </div>
    <div class="body">
      <h2 style="margin-top:0; font-size: 18px; color: #0f3d38;">${title}</h2>
      ${bodyHtml}
    </div>
    <div class="footer">
      This is an automated email from ${APP_NAME}. Please do not reply.
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================
// SEND HELPER
// ============================================
interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(args: SendArgs): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
    });

    if (error) {
      console.error('[email] Send failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[email] Unexpected error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ============================================
// TEMPLATED EMAILS
// ============================================

// 1. Leave Applied — to Admin
export async function sendLeaveAppliedEmail(params: {
  employeeName: string;
  employeeEmail: string;
  fromDate: string;
  toDate: string;
  days: number;
  type: string;
  reason: string;
}) {
  const html = wrapHtml(
    'New Leave Request',
    `
    <p><b>${params.employeeName}</b> (${params.employeeEmail}) has applied for leave.</p>
    <div class="box">
      <b>Type:</b> ${params.type}<br>
      <b>From:</b> ${params.fromDate}<br>
      <b>To:</b> ${params.toDate}<br>
      <b>Days:</b> ${params.days}<br>
      <b>Reason:</b> ${params.reason}
    </div>
    <p>Please review it in the admin panel.</p>
  `
  );

  return sendEmail({
    to: env.ADMIN_NOTIFICATION_EMAIL,
    subject: `Leave Request from ${params.employeeName}`,
    html,
    replyTo: params.employeeEmail,
  });
}

// 2. Leave Approved/Rejected — to Employee
export async function sendLeaveReviewEmail(params: {
  employeeName: string;
  employeeEmail: string;
  status: 'Approved' | 'Rejected';
  fromDate: string;
  toDate: string;
  days: number;
  reason?: string;
}) {
  const isApproved = params.status === 'Approved';
  const html = wrapHtml(
    `Leave ${params.status}`,
    `
    <p>Hi ${params.employeeName},</p>
    <p>Your leave request has been <b style="color: ${isApproved ? '#059669' : '#e11d48'};">${params.status.toLowerCase()}</b>.</p>
    <div class="box">
      <b>From:</b> ${params.fromDate}<br>
      <b>To:</b> ${params.toDate}<br>
      <b>Days:</b> ${params.days}
      ${params.reason ? `<br><b>Note:</b> ${params.reason}` : ''}
    </div>
    ${isApproved ? '<p>Enjoy your time off! 🎉</p>' : '<p>Please contact your manager if you have questions.</p>'}
  `
  );

  return sendEmail({
    to: params.employeeEmail,
    subject: `Leave ${params.status}`,
    html,
  });
}

// 3. Welcome email — new employee
export async function sendWelcomeEmail(params: {
  employeeName: string;
  employeeEmail: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const html = wrapHtml(
    `Welcome to ${APP_NAME}!`,
    `
    <p>Hi ${params.employeeName},</p>
    <p>Your account has been created. Here are your login credentials:</p>
    <div class="box">
      <b>Email:</b> ${params.employeeEmail}<br>
      <b>Username:</b> ${params.username}<br>
      <b>Password:</b> <code>${params.tempPassword}</code>
    </div>
    <p><b>⚠️ Please change your password after first login.</b></p>
    <a href="${params.loginUrl}" class="btn">Login Now</a>
  `
  );

  return sendEmail({
    to: params.employeeEmail,
    subject: `Welcome to ${APP_NAME}`,
    html,
  });
}

// 4. Password reset — user requested
export async function sendPasswordResetEmail(params: {
  employeeName: string;
  employeeEmail: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const html = wrapHtml(
    'Reset Your Password',
    `
    <p>Hi ${params.employeeName},</p>
    <p>We received a request to reset your password. Click below to set a new one:</p>
    <a href="${params.resetUrl}" class="btn">Reset Password</a>
    <p style="font-size: 12px; color: #64748b;">This link expires in ${params.expiresInMinutes} minutes. If you didn't request this, ignore this email.</p>
  `
  );

  return sendEmail({
    to: params.employeeEmail,
    subject: 'Reset your password',
    html,
  });
}

// 5. Attendance override — notified to employee
export async function sendAttendanceOverrideEmail(params: {
  employeeName: string;
  employeeEmail: string;
  date: string;
  status: string;
  notes: string;
}) {
  const html = wrapHtml(
    'Attendance Updated',
    `
    <p>Hi ${params.employeeName},</p>
    <p>Your attendance for <b>${params.date}</b> was updated by admin.</p>
    <div class="box">
      <b>Status:</b> ${params.status}<br>
      ${params.notes ? `<b>Notes:</b> ${params.notes}` : ''}
    </div>
  `
  );

  return sendEmail({
    to: params.employeeEmail,
    subject: `Attendance Update — ${params.date}`,
    html,
  });
}