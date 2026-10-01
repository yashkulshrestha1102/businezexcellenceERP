'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPublicCompanySettings } from '@/lib/actions/mails';
import type { CompanySettings } from '@/types/database';
import {
  DEFAULT_WORK_START,
  DEFAULT_WORK_END,
  DEFAULT_HALF_DAY_HOURS,
  DEFAULT_FULL_DAY_HOURS,
  DEFAULT_LATE_GRACE_MINUTES,
  STORAGE_KEYS,
  APP_NAME,
} from '@/lib/constants';

// Public-safe company settings (NO admin_email)
type PublicCompanySettings = Omit<CompanySettings, 'admin_email'> & {
  admin_email?: null;
};

interface CompanySettingsState {
  settings: PublicCompanySettings | null;
  loading: boolean;
  initialized: boolean;
  load: (force?: boolean) => Promise<void>;
  clear: () => void;
}

const fallback: PublicCompanySettings = {
  id: 1,
  company_name: APP_NAME,
  admin_email: null,
  work_start: DEFAULT_WORK_START,
  work_end: DEFAULT_WORK_END,
  half_day_hours: DEFAULT_HALF_DAY_HOURS,
  full_day_hours: DEFAULT_FULL_DAY_HOURS,
  late_grace_minutes: DEFAULT_LATE_GRACE_MINUTES,
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
          const s = await getPublicCompanySettings();
          set({
            settings: {
              ...fallback,
              ...(s as PublicCompanySettings),
              admin_email: null, // never expose
            },
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