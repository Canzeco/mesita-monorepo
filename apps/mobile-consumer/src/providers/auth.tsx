import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';

import {
  apiFetchConsumerProfile,
  isOnboarded,
  type ConsumerClass,
  type ConsumerProfile,
  type ConsumerStats,
} from '@/lib/api/auth';
import { legacyKeyForStoredClass } from '@/lib/consumer-classes';
import { supabase } from '@/lib/supabase';

// The server writes metals (`bronze`/`diamond`); this app compares on the
// legacy keys. `legacyKeyForStoredClass` is the one bridge — before
// MESITA-2044 this function only knew the legacy keys, so a real `diamond`
// normalized to Standard and a guest on the Diamond List read "Ask to join".
// A stray or unknown key (the retired "magnetic", a leftover silver/gold)
// still lands on Standard: not on the list.
function normalizeClass(raw: ConsumerClass | null): ConsumerClass | null {
  if (!raw) return null;
  const key = legacyKeyForStoredClass(raw.class ?? raw.key, raw.plan);
  return {
    ...raw,
    class: key,
    key,
    origin: raw.origin ?? 'default',
    followers: raw.followers ?? 0,
  };
}


// RN replacement for the web's middleware + (shell)/layout.tsx guards:
// one context that tracks the Supabase session and the consumer profile,
// and exposes the same onboarded predicate. Navigation gating happens in
// route components (src/app/index.tsx) off this state.
type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: ConsumerProfile | null;
  consumerClass: ConsumerClass | null;
  /** Profile stats (MESITA-888) — null until the first profile read lands. */
  stats: ConsumerStats | null;
  onboarded: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [consumerClass, setConsumerClass] = useState<ConsumerClass | null>(null);
  const [stats, setStats] = useState<ConsumerStats | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const result = await apiFetchConsumerProfile();
        if (!active) return;
        setProfile(result.consumer);
        setConsumerClass(normalizeClass(result.class));
        setStats(result.stats ?? { visits: 0 });
      } catch {
        // Keep the last-known-good profile on a transient EF/network failure.
        // Nulling it here would flip `onboarded` to false and, via the (tabs)
        // guard, eject an already-onboarded user to /onboard on a routine
        // TOKEN_REFRESHED refetch (app foreground after token expiry). A
        // genuine "no profile" arrives on the SUCCESS path above
        // (result.consumer === null), never through this catch.
      }
    };

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        await loadProfile();
      }
      if (active) setLoading(false);
    };

    void bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        void loadProfile();
      } else {
        setProfile(null);
        setConsumerClass(null);
        setStats(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const result = await apiFetchConsumerProfile();
    setProfile(result.consumer);
    setConsumerClass(normalizeClass(result.class));
    setStats(result.stats ?? { visits: 0 });
  };

  const signOut = async () => {
    // Sign-out must land the user on the auth surface — clearing the session
    // alone left them stranded on whatever authed screen they were on. The
    // (tabs) guard also redirects once `session` clears, but navigating here
    // makes the transition immediate and covers non-tab callers.
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace('/sign-in');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        profile,
        consumerClass,
        stats,
        onboarded: isOnboarded(profile),
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
