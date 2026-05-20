// Frontend API surface for ownership-verification Edge Functions.
//
// Manager submits one of three methods (ai_call / video / postcard);
// the EF either auto-approves (when app_settings.auto_verify_venues is
// true) or leaves the row pending for an admin to decide.

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

export type SubmitVerificationInput = {
  venueId: string;
  method: VerificationMethod;
  requesterEmail: string;
  videoUrl?: string;
};

export async function apiSubmitVerification(
  client: SupabaseClient,
  input: SubmitVerificationInput,
): Promise<{ id: string; status: VerificationStatus }> {
  const { verification } = await invokeEF<{
    verification: {
      id: string;
      status: VerificationStatus;
      decided_via: "auto" | "admin" | null;
      decided_at: string | null;
    };
  }>(client, "manager-submit-verification", input);
  return { id: verification.id, status: verification.status };
}

export async function apiGetVerification(
  client: SupabaseClient,
  venueId: string,
): Promise<Verification | null> {
  const { verification } = await invokeEF<{
    verification: Verification | null;
  }>(client, "manager-get-verification", { venueId });
  return verification;
}
