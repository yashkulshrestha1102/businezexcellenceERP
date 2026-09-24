/**
 * Timezone-safe date helpers for IST (Asia/Kolkata, UTC+5:30)
 * Works on server (Vercel UTC) and client (any timezone)
 */

import { IST_OFFSET_MINUTES, TIMEZONE } from '@/lib/constants';

interface ISTParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  weekday: number;
}

function getISTParts(): ISTParts {
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const ist = new Date(istMs);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth() + 1,
    day: ist.getUTCDate(),
    hours: ist.getUTCHours(),
    minutes: ist.getUTCMinutes(),
    seconds: ist.getUTCSeconds(),
    weekday: ist.getUTCDay(),
  };
}

export function todayStr(): string {
  const t = getISTParts();
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
}

export function nowTime(): string {
  const t = getISTParts();
  return `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;
}

export function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtTime(timeStr?: string | null, use24h = false): string {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  if (use24h) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function shiftDate(days: number): string {
  const t = getISTParts();
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function monthKey(dateStr?: string | null): string {
  return (dateStr || '').slice(0, 7);
}

export function diffDays(from: string, to: string): number {
  const d1 = new Date(from + 'T00:00:00');
  const d2 = new Date(to + 'T00:00:00');
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

export function hoursBetween(from: string, to: string): number {
  const [h1, m1] = from.split(':').map(Number);
  const [h2, m2] = to.split(':').map(Number);
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  return diff > 0 ? diff / 60 : 0;
}

export function initials(name?: string): string {
  return (name || '?')
    .split(' ')
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function monthLastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}