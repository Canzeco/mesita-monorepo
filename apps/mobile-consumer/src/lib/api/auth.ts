// Auth + profile EF surface — mirrors apps/web-consumer/src/lib/api/{auth,profile}.ts.
// Clients never touch the DB: every read/write goes through an Edge Function.

import { EFError, invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';

type ConsumerSummary = {
  id: string;
  code: string;
  full_name: string | null;
  phone: string | null;
};

type SigninPhoneResult = {
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
  avatar_url?: string | null;
};

// Matches consumer-web-get-profile `class` payload (EF uses `key`).
// AuthProvider.normalizeClass fills both `key` and `class` for call-site compat.
export type ConsumerClass = {
  key?: 'free' | 'premium';
  /** Normalized alias of `key` — existing screens still read `.class`. */
  class?: 'free' | 'premium';
  origin?: 'default' | 'instagram' | 'subscription' | 'invitation' | string | null;
  label?: string;
  followers?: number | null;
  expires_at?: string | null;
  subscription?: {
    status: string;
    price_cents: number;
    currency: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | Record<string, unknown> | null;
  usage?: {
    reservations_used: number;
    reservations_limit: number | null;
  } | Record<string, unknown> | null;
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

// consumer-web-claim-instagram — social door into Premium (1,000+ followers).
export type InstagramClaimResult = {
  tier: 'free' | 'premium';
  followers: number;
  handle: string | null;
};

export function apiClaimInstagram(input: {
  followers: number;
  handle: string;
}): Promise<InstagramClaimResult> {
  return invokeEF<InstagramClaimResult>(
    supabase,
    'consumer-web-claim-instagram',
    input,
  );
}

// consumer-web-delete-account — irreversible. Caller must local sign-out after.
export async function apiDeleteConsumerAccount(): Promise<void> {
  await invokeEF<{ id: string }>(supabase, 'consumer-web-delete-account', {});
}

// Same predicate as the web (shell)/layout.tsx guard.
export function isOnboarded(profile: ConsumerProfile | null | undefined): boolean {
  return Boolean(profile?.full_name && profile?.birthday && profile?.sex);
}

export { EFError };
