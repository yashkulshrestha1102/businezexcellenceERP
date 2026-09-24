'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { useTodayAttendance } from '@/lib/hooks/useTodayAttendance';
import { todayStr, fmtDate, fmtTime, initials } from '@/lib/utils/date';
import {
  checkIn,
  checkOut,
} from '@/lib/actions/attendance';
import { getMyLeaveBalance } from '@/lib/actions/leaves';
import { getMyAssets } from '@/lib/actions/assets';
import { APP_NAME } from '@/lib/constants';

interface CheckInResult {
  success: boolean;
  time?: string;
  late?: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
}

interface CheckOutResult {
  success: boolean;
  time?: string;
  hours?: number;
  short_day?: boolean;
  alreadyCheckedOut?: boolean;
  message?: string;
}

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const { settings } = useCompanySettings();

  // ✅ Cached hook — refresh pe instant, no skeleton flicker
  const {
    today,
    initialized,
    loadToday,
  } = useTodayAttendance();

  const [balance, setBalance] = useState({ approved: 0, pending: 0 });
  const [assetCount, setAssetCount] = useState(0);
  const [loading, setLoading] = useState(!initialized);
  const [working, setWorking] = useState(false);

  // Load once on mount — non-critical data can show skeleton
  const loadStats = useCallback(async () => {
    try {
      const [b, a] = await Promise.all([
        getMyLeaveBalance(),
        getMyAssets(),
      ]);
      setBalance(b);
      setAssetCount(a.length);
    } catch (err) {
      console.error('Stats load failed:', err);
    }
  }, []);

  useEffect(() => {
    loadToday();
    loadStats().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckIn() {
    setWorking(true);
    try {
      const res = (await checkIn()) as CheckInResult;

      if (res.alreadyCheckedIn) {
        toast.info(res.message || 'Already checked in', { duration: 3000 });
        await loadToday(true);
        return;
      }

      toast.success(
        res.late
          ? `Check In — ${res.time} (late 😅)`
          : `Check In — ${res.time}`,
        { duration: 3000 }
      );
      await loadToday(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function handleCheckOut() {
    setWorking(true);
    try {
      const res = (await checkOut()) as CheckOutResult;

      if (res.alreadyCheckedOut) {
        toast.info(res.message || 'Already checked out', { duration: 3000 });
        await loadToday(true);
        return;
      }

      toast.success(`Check Out — ${res.time} (${res.hours}h)`);
      await loadToday(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(false);
    }
  }

  if (!profile) return null;

  const hasCheckIn = !!today?.check_in;
  const hasCheckOut = !!today?.check_out;
  const brandName = settings?.company_name || APP_NAME;

  // ✅ Use today.date instead of todayStr() — record ki actual date
  let headline: string;
  let sub: string;
  if (hasCheckIn && hasCheckOut) {
    headline = 'Aaj ka kaam complete ✅';
    sub = `${fmtDate(today.date)} • In: ${fmtTime(today.check_in)} • Out: ${fmtTime(today.check_out)}`;
  } else if (hasCheckIn) {
    headline = 'Aaj present ho ✅';
    sub = `${fmtDate(today.date)} • Check In: ${fmtTime(today.check_in)}${today.late ? ' (late)' : ''}`;
  } else {
    headline = 'Aaj ka attendance mark karo';
    sub = `${fmtDate(todayStr())} • Abhi tak check-in nahi kiya`;
  }

  // ✅ Work hours — formatted properly
  const workStart = settings?.work_start ? fmtTime(settings.work_start) : '—';
  const workEnd = settings?.work_end ? fmtTime(settings.work_end) : '—';

  // ✅ First load only (no cache) — show skeleton
  if (loading && !initialized) {
    return (
      <div className="page-loader">
        <div className="spinner spinner-dark" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Namaste, {profile.name.split(' ')[0]} 👋</h1>
          <p>
            {profile.designation || '—'} • {profile.dept || '—'} • {brandName}
          </p>
        </div>
      </div>

      <div className="attend-box">
        <div>
          <h2>{headline}</h2>
          <p>{sub}</p>
        </div>
        <div className="attend-actions">
          <button
            className="btn-checkin"
            disabled={hasCheckIn || working}
            onClick={handleCheckIn}
          >
            🟢 Check In
          </button>
          <button
            className="btn-checkout"
            disabled={!hasCheckIn || hasCheckOut || working}
            onClick={handleCheckOut}
          >
            🔴 Check Out
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="lbl">Leaves Taken</div>
          <div className="val">{balance.approved}</div>
          <div className="sub">{balance.pending} pending</div>
        </div>
        <div className="stat">
          <div className="lbl">My Assets</div>
          <div className="val">{assetCount}</div>
          <div className="sub">assigned to you</div>
        </div>
        <div className="stat">
          <div className="lbl">Work Hours</div>
          <div className="val" style={{ fontSize: 18 }}>
            {workStart} - {workEnd}
          </div>
          <div className="sub">office timings</div>
        </div>
        <div className="stat">
          <div className="lbl">Username</div>
          <div className="val" style={{ fontSize: 18 }}>
            {profile.username}
          </div>
          <div className="sub">login id</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>👤 Profile</h3>
        </div>
        <div className="panel-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              className="avatar"
              style={{ width: 56, height: 56, fontSize: 20 }}
            >
              {initials(profile.name)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {profile.name}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>
                {profile.email}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>
                Joined {fmtDate(profile.join_date)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}