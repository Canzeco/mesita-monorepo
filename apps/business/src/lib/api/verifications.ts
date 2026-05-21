// Frontend API surface for ownership-verification Edge Functions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type VerificationMethod = "ai_call" | "video" | "postcard";
export type VerificationStatus = "pending" | "approved" | "rejected";

export type Verification = {
  id: string;
  method: VerificationMethod;
  payload: Record<string, unknown>;
  requester_email: string;
  status: VerificationStatus;
  reject_reason: string | null;
  decided_at: string | null;
  decided_via: "auto" | "admin" | null;
  created_at: string;
};

// Slim venue shape the lookup EF returns.
export type LookupVenue = {
  id: string;
  slug: string;
  name: string;
  status: string;
  listing_type: "web" | "partner" | "unclaimed";
  address: string | null;
  phone: string | null;
  photos: string[];
  category: string | null;
  vibe: string | null;
  cashback_percent: number | null;
  created_at: string;
  updated_at: string | null;
};

export type LookupResult =
  | { state: "not_in_mesita"; venue: null }
  | { state: "web_listed_unclaimed"; venue: LookupVenue }
  | {
      state: "pending_by_me";
      venue: LookupVenue;
      verification: Verification;
    }
  | { state: "pending_by_other"; venue: LookupVenue }
  | {
      state: "verified_partner";
      venue: LookupVenue;
      owner: { id: string; email: string | null };
    };

export async function apiLookupVenue(
  client: SupabaseClient,
  placeId: string,
): Promise<LookupResult> {
  return invokeEF<LookupResult>(client, "manager-lookup-venue", { placeId });
}

export type SubmitVerificationInput = {
  venueId: string;
  method: VerificationMethod;
  requesterEmail: string;
  videoUrl?: string;
};

export type SubmitVerificationResult = {
  id: string;
  status: VerificationStatus;
  // Populated only for ai_call submissions in mock mode (no Twilio).
  // The frontend shows this so the operator can test the OTP loop
  // without an actual phone call.
  mockCode: string | null;
};

type SubmitVerificationPayload = {
  verification: {
    id: string;
    status: VerificationStatus;
    decided_via: "auto" | "admin" | null;
    decided_at: string | null;
  };
  mockCode: string | null;
};

export async function apiSubmitVerification(
  client: SupabaseClient,
  input: SubmitVerificationInput,
): Promise<SubmitVerificationResult> {
  const { verification, mockCode } = await invokeEF<SubmitVerificationPayload>(
    client,
    "manager-submit-verification",
    input,
  );
  return {
    id: verification.id,
    status: verification.status,
    mockCode: mockCode ?? null,
  };
}

export type VerifyCallCodeResult = {
  venueId: string;
  // True when the EF accepted the OTP but auto_verify_ai_call was off,
  // so the row sits in the admin queue awaiting a human decision.
  // False (default) means ownership was granted on the spot.
  awaitingAdmin: boolean;
};

// Phase 2 of the ai_call flow: operator types the 6-digit code they
// received (or saw in the mock banner) and we hash-compare server-side.
export async function apiVerifyCallCode(
  client: SupabaseClient,
  verificationId: string,
  code: string,
): Promise<VerifyCallCodeResult> {
  return invokeEF<VerifyCallCodeResult>(client, "manager-verify-call-code", {
    verificationId,
    code,
  });
}
