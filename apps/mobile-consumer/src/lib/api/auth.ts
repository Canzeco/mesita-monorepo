// Auth + profile EF surface — mirrors mesita-web-consumer src/lib/api/{auth,profile}.ts.
// Clients never touch the DB: every read/write goes through an Edge Function.

import { EFError, invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';

export type ConsumerSummary = {
  id: string;
  code: string;
  full_name: string | null;
  phone: string | null;
};

export type SigninPhoneResult = {
  role: string;
  consumer: ConsumerSummary | null;
  onboarded: boolean;
};

// Call immediately after a successful verifyOtp — the RN equivalent of the
// web /auth/post-signin hop. Stamps app_metadata.role and lazy-creates the
// consumers row.
export function apiConsumerSigninPhone(): Promise<SigninPhoneResult> {
  return invokeEF<SigninPhoneResult>(supabase, 'consumer-web-signin-phone', {});
}

export type ConsumerProfile = {
  id: string;
  code: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone: string | null;
  birthday: string | null;
  sex: string | null;
  /** Claimed Instagram username — normalized, no leading @. */
  instagram_handle?: string | null;
  /** @deprecated legacy alias — prefer instagram_handle */
  instagram?: string | null;
};

export type ConsumerClass = {
  /** Mobile historically used `class`; web uses `key`. Accept both. */
  class?: 'free' | 'premium';
  key?: 'free' | 'premium';
  origin?: string | null;
  followers?: number | null;
  subscription?: Record<string, unknown> | null;
  usage?: Record<string, unknown> | null;
};

export type ProfileResult = {
  consumer: ConsumerProfile;
  class: ConsumerClass | null;
};

export function apiFetchConsumerProfile(): Promise<ProfileResult> {
  return invokeEF<ProfileResult>(supabase, 'consumer-web-get-profile', {});
}

export function apiUpdateConsumerProfile(patch: {
  first_name?: string;
  sex?: 'male' | 'female' | 'other';
  birthday?: string; // YYYY-MM-DD
}): Promise<ProfileResult> {
  return invokeEF<ProfileResult>(supabase, 'consumer-web-update-profile', patch);
}

// Same predicate as the web (shell)/layout.tsx guard.
export function isOnboarded(profile: ConsumerProfile | null | undefined): boolean {
  return Boolean(profile?.full_name && profile?.birthday && profile?.sex);
}

export { EFError };
