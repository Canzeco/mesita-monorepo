import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { LargeSecureStore } from '@/lib/storage';

// Same publishable-key naming as the web apps (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // On web (preview builds) supabase-js falls back to localStorage.
    ...(Platform.OS !== 'web' ? { storage: new LargeSecureStore() } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is foregrounded (Supabase RN guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
