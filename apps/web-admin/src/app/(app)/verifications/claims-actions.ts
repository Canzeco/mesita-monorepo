"use server";

import { efInvoke } from "@/lib/supabase-ef";

export type AdminPlaceClaim = {
  id: string;
  claimed_by: string;
  claimed_at: string;
  claim_reviewed_at: string | null;
  claim_reviewed_by: string | null;
  organization: { id: string; name: string } | null;
  claimer: { full_name: string | null; email: string | null };
  place: { name: string | null; address: string | null; google_place_id: string | null };
};

type ListResponse = { claims: AdminPlaceClaim[] };
type ListResult = { ok: true; data: ListResponse } | { ok: false; error: string };

export async function listPlaceClaims(): Promise<ListResult> {
  const r = await efInvoke<ListResponse>("admin-web-list-place-claims", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { claims: r.data.claims } };
}

type DecideResult = { ok: true } | { ok: false; error: string };

export async function decidePlaceClaim(
  placeId: string,
  decision: "clear" | "reverse",
): Promise<DecideResult> {
  const r = await efInvoke<unknown>("admin-web-decide-place-claim", {
    placeId,
    decision,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true };
}
