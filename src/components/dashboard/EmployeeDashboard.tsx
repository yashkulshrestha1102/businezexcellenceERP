'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { todayStr, nowTime, fmtDate, initials } from '@/lib/utils/date';
import {
  checkIn,
  checkOut,
  getMyTodayAttendance,
} from '@/lib/actions/attendance';
import { getMyLeaveBalance } from '@/lib/actions/leaves';
import { getMyAssets } from '@/lib/actions/assets';

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const [today, setToday] = useState<{
    check_in: string | null;
    check_out: string | null;
    status: string;
    late: boolean;
  } | null>(null);
  const [balance, setBalance] = useState({ approved: 0, pending: 0 });
  const [assetCount, setAssetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, b, a] = await Promise.all([
        getMyTodayAttendance(),
        getMyLeaveBalance(),
        getMyAssets(),
      ]);
      setToday(t);
      setBalance(b);
      setAssetCount(a.length);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCheckIn() {
    setWorking(true);
    try {
      const res = await checkIn();
      toast.success(
        res.late ? `Check In — ${res.time} (late 😅)` : `Check In — ${res.time}`,
        { duration: 3000 }
      );
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function handleCheckOut() {
    setWorking(true);
    try {
      const res = await checkOut();
      toast.success(`Check Out — ${res.time} (${res.hours}h)`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(false);
    }
  }

  if (!profile) return null;

  const hasCheckIn = !!today?.check_in;
  const hasCheckOut = !!today?.check_out;

  let headline: string;
  let sub: string;
  if (hasCheckIn && hasCheckOut) {
    headline = 'Aaj ka kaam complete ✅';
    sub = `${fmtDate(todayStr())} • In: ${today!.check_in!.slice(0, 5)} • Out: ${today!.check_out!.slice(0, 5)}`;
  } else if (hasCheckIn) {
    headline = 'Aaj present ho ✅';
    sub = `${fmtDate(todayStr())} • Check In: ${today!.check_in!.slice(0, 5)}${today!.late ? ' (late)' : ''}`;
  } else {
    headline = 'Aaj ka attendance mark karo';
    sub = `${fmtDate(todayStr())} • Abhi tak check-in nahi kiya`;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Namaste, {profile.name.split(' ')[0]} 👋</h1>
          <p>
            {profile.designation || '—'} • {profile.dept || '—'}
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
          <div className="lbl">Role</div>
          <div className="val" style={{ textTransform: 'capitalize', fontSize: 20 }}>
            {profile.role}
          </div>
          <div className="sub">{profile.dept || 'No dept'}</div>
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