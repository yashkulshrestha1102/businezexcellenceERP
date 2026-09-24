'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { STORAGE_KEYS } from '@/lib/constants';

interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  fetching: boolean;
  loadProfile: (force?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: true,
      initialized: false,
      fetching: false,

      loadProfile: async (force = false) => {
        const state = get();
        if (state.fetching) return;
        if (state.initialized && !force) {
          // Already loaded, skip
          set({ loading: false });
          return;
        }

        set({ fetching: true });
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();

          if (!user) {
            set({
              user: null,
              profile: null,
              loading: false,
              initialized: true,
              fetching: false,
            });
            return;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

          set({
            user: { id: user.id, email: user.email || '' },
            profile: (profile as Profile) || null,
            loading: false,
            initialized: true,
            fetching: false,
          });
        } catch (err) {
          console.error('useAuth loadProfile error:', err);
          set({ loading: false, initialized: true, fetching: false });
        }
      },

      refresh: async () => {
        await get().loadProfile(true);
      },

      signOut: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        set({
          user: null,
          profile: null,
          initialized: false,
          loading: false,
        });
      },

      clear: () =>
        set({
          user: null,
          profile: null,
          loading: false,
          initialized: false,
        }),
    }),
    {
      name: STORAGE_KEYS.AUTH_CACHE,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user: s.user,
        profile: s.profile,
      }),
    }
  )
);