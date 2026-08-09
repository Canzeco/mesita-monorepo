"use server";

import { efInvoke } from "@/lib/supabase-ef";

type VerificationMethod = "ai_call" | "video" | "postcard";
type VerificationStatus = "pending" | "approved" | "rejected";

export type AdminVerification = {
  id: string;
  project_id: string;
  requester_id: string;
  method: VerificationMethod;
  payload: Record<string, unknown>;
  requester_email: string;
  status: VerificationStatus;
  reject_reason: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decided_via: "auto" | "admin" | null;
  created_at: string;
  // Flattened by the EF from project + place: id/slug/status are the
  // project's, the rest the place's.
  place: {
    id: string;
    slug: string | null;
    name: string | null;
    status: string | null;
    phone: string | null;
    address: string | null;
    google_place_id: string | null;
  } | null;
};

type ListResponse = {
  verifications: AdminVerification[];
};

type ListResult =
  | { ok: true; data: ListResponse }
  | { ok: false; error: string };

export async function listVerifications(): Promise<ListResult> {
  const r = await efInvoke<ListResponse>("admin-web-list-verifications", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { verifications: r.data.verifications } };
}

type DecideResult =
  | { ok: true }
  | { ok: false; error: string };

export async function decideVerification(
  verificationId: string,
  decision: "approved" | "rejected",
  rejectReason: string,
): Promise<DecideResult> {
  const r = await efInvoke<unknown>("admin-web-decide-verification", {
    verificationId,
    decision,
    rejectReason: decision === "rejected" ? rejectReason : undefined,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}
