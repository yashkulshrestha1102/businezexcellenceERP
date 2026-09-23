'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';

interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  loadProfile: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      set({ user: null, profile: null, loading: false, initialized: true });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    set({
      user: { id: user.id, email: user.email || '' },
      profile: profile as Profile | null,
      loading: false,
      initialized: true,
    });
  },

  refresh: async () => {
    await get().loadProfile();
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, profile: null });
  },
}));