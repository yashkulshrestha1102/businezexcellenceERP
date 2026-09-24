'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getMyTodayAttendance } from '@/lib/actions/attendance';
import { todayStr } from '@/lib/utils/date';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  late: boolean;
  short_day: boolean;
  hours: number;
  marked_by: string;
  notes: string | null;
}

interface TodayAttendanceState {
  // Cached attendance for today (persisted)
  today: AttendanceRecord | null;
  // Which date is the cache for? (to invalidate on new day)
  cacheDate: string | null;
  // Is a fetch currently in-flight?
  fetching: boolean;
  // Has the initial fetch completed?
  initialized: boolean;

  loadToday: (force?: boolean) => Promise<void>;
  setToday: (record: AttendanceRecord | null) => void;
  clearCache: () => void;
}

export const useTodayAttendance = create<TodayAttendanceState>()(
  persist(
    (set, get) => ({
      today: null,
      cacheDate: null,
      fetching: false,
      initialized: false,

      loadToday: async (force = false) => {
        const currentDate = todayStr();
        const state = get();

        // If cache is for a different day, invalidate it
        if (state.cacheDate && state.cacheDate !== currentDate) {
          set({ today: null, cacheDate: null });
        }

        // Prevent duplicate concurrent fetches
        if (state.fetching && !force) return;

        set({ fetching: true });

        try {
          const data = await getMyTodayAttendance();
          set({
            today: (data as AttendanceRecord) || null,
            cacheDate: currentDate,
            fetching: false,
            initialized: true,
          });
        } catch (err) {
          console.error('🔥 useTodayAttendance error:', err);
          set({ fetching: false, initialized: true });
        }
      },

      setToday: (record) =>
        set({
          today: record,
          cacheDate: todayStr(),
          initialized: true,
        }),

      clearCache: () =>
        set({
          today: null,
          cacheDate: null,
          fetching: false,
          initialized: false,
        }),
    }),
    {
      name: 'roster-today-attendance',
      storage: createJSONStorage(() => localStorage),
      // Only persist data fields, not functions
      partialize: (state) => ({
        today: state.today,
        cacheDate: state.cacheDate,
      }),
    }
  )
);