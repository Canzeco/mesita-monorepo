import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';

import {
  apiFetchConsumerProfile,
  isOnboarded,
  type ConsumerClass,
  type ConsumerProfile,
} from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';

// The known class keys — an unknown/stale server key (e.g. the retired
// "magnetic") normalizes to Standard instead of leaking into gates.
const KNOWN_CLASS_KEYS = ['standard', 'premium', 'influencer', 'aura'] as const;

function normalizeClass(raw: ConsumerClass | null): ConsumerClass | null {
  if (!raw) return null;
  const raw_key = raw.class ?? raw.key ?? 'standard';
  const key = (KNOWN_CLASS_KEYS as readonly string[]).includes(raw_key)
    ? (raw_key as (typeof KNOWN_CLASS_KEYS)[number])
    : 'standard';
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

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const result = await apiFetchConsumerProfile();
        if (!active) return;
        setProfile(result.consumer);
        setConsumerClass(normalizeClass(result.class));
      } catch {
        // Keep the last-known-good profile on a transient EF/network failure.
        // Nulling it here would flip `onboarded` to false and, via the (tabs)
        // guard, eject an already-onboarded user to /onboard on a routine
        // TOKEN_REFRESHED refetch (app foreground after token expiry). A
        // genuine "no profile" arrives on the SUCCESS path above
        // (result.consumer === null), never through this catch.
        if (!active) return;
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
