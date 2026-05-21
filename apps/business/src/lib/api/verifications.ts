// Frontend API surface for ownership-verification Edge Functions.
//
// Three methods power the /add flow:
//
//   ai_call         — Twilio call/SMS reads a 6-digit code to the
//                     Google-listed phone. (Currently mock-only;
//                     mockCode is returned when Twilio env vars are
//                     missing.) Auto-grants ownership on correct code.
//   ai_email        — Transactional email sends a 6-digit code to a
//                     Firecrawl-discovered on-domain email. (Currently
//                     mock-only; same mockCode contract.) Auto-grants
//                     ownership on correct code.
//   manual_contact  — Always available. Writes a pending row so the
//                     admin queue sees the request, then routes the
//                     operator to Mesita ops via WhatsApp / SMS / email
//                     (region-adaptive). Never auto-verifies.
//
// All EFs follow the <caller>-<verb>-<words> naming convention; this
// module is a thin typed wrapper around them via invokeEF.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// ── Shared types ──────────────────────────────────────────────────────

// The UI doesn't pick `video` or `postcard` anymore; those values
// remain in the DB enum for backwards compatibility with historical
// rows the admin queue might still surface, but the FE only emits the
// three live methods.
export type VerificationMethod = "ai_call" | "ai_email" | "manual_contact";
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

export type LookupVenue = {
  id: string;
  slug: string;
  name: string;
  status: string;
  listing_type: "web" | "partner" | "unclaimed";
  address: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  country: string | null;
  photos: string[];
  category: string | null;
  vibe: string | null;
  cashback_percent: number | null;
  created_at: string;
  updated_at: string | null;
};

export type ManualRegion = "mx_latam" | "us" | "other";

// What the UI needs to decide which method cards to render and how the
// manual fallback should look. Returned by manager-lookup-venue for
// every claim-able state.
export type LookupMethods = {
  phone: { available: boolean; displayPhone: string | null };
  email: { available: boolean; displayEmail: string | null };
  manual: {
    region: ManualRegion;
    whatsapp: string | null;
    sms: string | null;
    email: string;
  };
};

export type LookupResult =
  | { state: "not_in_mesita"; venue: null }
  | { state: "web_listed_unclaimed"; venue: LookupVenue; methods: LookupMethods }
  | {
      state: "pending_by_me";
      venue: LookupVenue;
      verification: Verification;
      methods: LookupMethods;
    }
  | { state: "pending_by_other"; venue: LookupVenue; methods: LookupMethods }
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

// ── Phone OTP path ────────────────────────────────────────────────────

export type SendPhoneOtpResult = {
  verificationId: string;
  // "call" or "sms" — chosen by the EF based on venue country (call for
  // LatAm landlines, SMS for US/CA). Surfaced so the UI can phrase the
  // confirmation correctly ("We called …" vs. "We texted …").
  channel: "call" | "sms";
  phoneDialed: string;
  // Populated only when Twilio env vars are missing (mock mode). Lets
  // the operator complete the loop without an actual call/SMS.
  mockCode: string | null;
};

export async function apiManagerSendsPhoneOtp(
  client: SupabaseClient,
  venueId: string,
  requesterEmail: string,
): Promise<SendPhoneOtpResult> {
  return invokeEF<SendPhoneOtpResult>(client, "manager-sends-phone-otp", {
    venueId,
    requesterEmail,
  });
}

export type VerifyOtpResult = {
  venueId: string;
  // True when the EF accepted the OTP but auto-verify was off for this
  // method, so the row sits in the admin queue. False (default) means
  // ownership was granted on the spot.
  awaitingAdmin: boolean;
};

export async function apiManagerVerifiesPhone(
  client: SupabaseClient,
  verificationId: string,
  code: string,
): Promise<VerifyOtpResult> {
  return invokeEF<VerifyOtpResult>(client, "manager-verifies-phone", {
    verificationId,
    code,
  });
}

// ── Email OTP path ────────────────────────────────────────────────────

export type SendEmailOtpResult = {
  verificationId: string;
  sentTo: string;
  // Populated only when the email provider isn't configured (mock mode).
  mockCode: string | null;
};

export async function apiManagerSendsEmailOtp(
  client: SupabaseClient,
  venueId: string,
  requesterEmail: string,
): Promise<SendEmailOtpResult> {
  return invokeEF<SendEmailOtpResult>(client, "manager-sends-email-otp", {
    venueId,
    requesterEmail,
  });
}

export async function apiManagerVerifiesEmail(
  client: SupabaseClient,
  verificationId: string,
  code: string,
): Promise<VerifyOtpResult> {
  return invokeEF<VerifyOtpResult>(client, "manager-verifies-email", {
    verificationId,
    code,
  });
}

// ── Manual fallback ───────────────────────────────────────────────────

export type RequestManualReviewResult = {
  verificationId: string;
  region: ManualRegion;
  contact: {
    whatsapp: string | null;
    sms: string | null;
    email: string;
  };
  venueName: string;
};

export async function apiManagerRequestsManualReview(
  client: SupabaseClient,
  venueId: string,
  requesterEmail: string,
  note?: string,
): Promise<RequestManualReviewResult> {
  return invokeEF<RequestManualReviewResult>(
    client,
    "manager-requests-manual-review",
    { venueId, requesterEmail, note },
  );
}
