"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

// A CLAIM IS THE CLAIMER AND THE TIMESTAMP (MESITA-1892). It used to carry the
// organization the place was claimed INTO, because claiming meant joining a
// place to an org. The org layer is gone — `claim_place(p_place_id, p_claimer)`
// writes `claimed_by` + `claimed_at` on the place itself — so who claimed it is
// the whole story, and `claimer` below already tells it.
export type AdminPlaceClaim = {
  id: string;
  claimed_by: string;
  claimed_at: string;
  claim_reviewed_at: string | null;
  claim_reviewed_by: string | null;
  claimer: { full_name: string | null; email: string | null };
  place: { name: string | null; address: string | null; google_place_id: string | null };
};

type ListResponse = { claims: AdminPlaceClaim[] };
type ListResult = ActionResult<{ data: ListResponse }>;

export async function listPlaceClaims(): Promise<ListResult> {
  const r = await efInvoke<ListResponse>("admin-web-list-place-claims", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { claims: r.data.claims } };
}

type DecideResult = ActionResult;

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
