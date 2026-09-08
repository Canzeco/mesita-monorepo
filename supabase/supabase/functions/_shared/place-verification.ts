// The one shape of write every "mark this place Verified" caller needs:
// idempotent (Verified never lapses, MESITA-1320 — an existing approved row
// is success, not a duplicate), and it must write `decided_via` as one of
// the two values the DB actually allows.
//
// `decided_via`'s check constraint is `in ('auto', 'admin')` — it names WHO
// decided, never HOW. `method` is the separate, wider column for that
// ('mock_code', 'manual_contact', 'ai_call', ...). Three callers used to
// each write this insert by hand: admin-web-set-place-verified (decided_via
// 'admin'), business-web-verify-place (which had crossed the two columns
// and written its `method` value into `decided_via`, tripping the check
// constraint on every real submission), and now business-web-claim-place
// (MESITA-1690, auto-verify on claim). One shared writer means the
// constraint gets satisfied in exactly one place, not memorized three times.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type VerificationResult =
  | { ok: true; verified: true; alreadyVerified: boolean }
  | { ok: false; error: string };

/** Writes an approved `place_verifications` row for `placeId` unless one
 *  already exists. Every field the DB requires is supplied here, once. */
export async function writeApprovedVerification(
  admin: SupabaseClient,
  args: {
    placeId: string;
    userId: string;
    userEmail: string;
    /** The `verification_method` enum value — how the decision was made,
     *  never who made it. */
    method: string;
    /** The `decided_via` check constraint's two values — who decided. */
    decidedVia: "auto" | "admin";
  },
): Promise<VerificationResult> {
  const existing = await admin
    .from("place_verifications")
    .select("id")
    .eq("place_id", args.placeId)
    .eq("state", "approved")
    .limit(1);
  if (existing.error) return { ok: false, error: existing.error.message };
  if ((existing.data ?? []).length > 0) {
    return { ok: true, verified: true, alreadyVerified: true };
  }

  const insert = await admin.from("place_verifications").insert({
    place_id: args.placeId,
    requester_id: args.userId,
    requester_email: args.userEmail,
    method: args.method,
    state: "approved",
    decided_at: new Date().toISOString(),
    decided_by: args.userId,
    decided_via: args.decidedVia,
    payload: {},
  });
  if (insert.error) return { ok: false, error: insert.error.message };
  return { ok: true, verified: true, alreadyVerified: false };
}
