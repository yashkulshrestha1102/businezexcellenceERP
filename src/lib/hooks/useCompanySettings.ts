'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getCompanySettings } from '@/lib/actions/mails';
import type { CompanySettings } from '@/types/database';
import {
  DEFAULT_WORK_START,
  DEFAULT_WORK_END,
  DEFAULT_HALF_DAY_HOURS,
  DEFAULT_FULL_DAY_HOURS,
  STORAGE_KEYS,
} from '@/lib/constants';

interface CompanySettingsState {
  settings: CompanySettings | null;
  loading: boolean;
  initialized: boolean;
  load: (force?: boolean) => Promise<void>;
  clear: () => void;
}

const fallback: CompanySettings = {
  id: 1,
  company_name: 'Roster Pro',
  admin_email: null,
  work_start: DEFAULT_WORK_START,
  work_end: DEFAULT_WORK_END,
  half_day_hours: DEFAULT_HALF_DAY_HOURS,
  full_day_hours: DEFAULT_FULL_DAY_HOURS,
  late_grace_minutes: 15,
  updated_at: new Date().toISOString(),
};

export const useCompanySettings = create<CompanySettingsState>()(
  persist(
    (set, get) => ({
      settings: null,
      loading: false,
      initialized: false,

      load: async (force = false) => {
        const state = get();
        if (state.loading) return;
        if (state.initialized && !force) return;

        set({ loading: true });
        try {
          const s = await getCompanySettings();
          set({
            settings: (s as CompanySettings) || fallback,
            loading: false,
            initialized: true,
          });
        } catch {
          set({
            settings: fallback,
            loading: false,
            initialized: true,
          });
        }
      },

      clear: () =>
        set({
          settings: null,
          loading: false,
          initialized: false,
        }),
    }),
    {
      name: STORAGE_KEYS.COMPANY_SETTINGS,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings }),
    }
  )
);