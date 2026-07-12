import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

import {
  apiFetchConsumerProfile,
  isOnboarded,
  type ConsumerClass,
  type ConsumerProfile,
} from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';

function normalizeClass(raw: ConsumerClass | null): ConsumerClass | null {
  if (!raw) return null;
  const tier = raw.class ?? raw.key ?? 'free';
  return {
    ...raw,
    class: tier === 'premium' ? 'premium' : 'free',
    key: tier === 'premium' ? 'premium' : 'free',
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
        // Same behavior as the web onboard page: EF failure falls through to
        // the onboard form rather than crashing the gate.
        if (!active) return;
        setProfile(null);
        setConsumerClass(null);
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
    await supabase.auth.signOut();
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
