// Verifying a place the organization already holds.
//
// A FILE OF ITS OWN, not a function added to `verifications.ts`. That module
// is the /add flow's email + phone OTP client, and /add is being removed by
// this same issue (MESITA-1664) — folding the new call in there would tie a
// surviving path to a dying one. It is also, right now, one of 121 files
// held uncommitted by MESITA-1590's rename sweep, so editing it would put
// this change into a conflict it has no reason to be in.
import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type PlaceVerifyResult = {
  verified: boolean;
  /** True when the place was already verified before this call. Verified
   *  never lapses (MESITA-1320), so re-submitting is a success, not an
   *  error, and the console says "Already verified" rather than pretending
   *  it just happened. */
  alreadyVerified: boolean;
};

export async function apiVerifyPlace(
  client: SupabaseClient,
  input: { placeId: string; code: string },
): Promise<PlaceVerifyResult> {
  return invokeEF<PlaceVerifyResult>(
    client,
    "business-web-verify-place",
    { placeId: input.placeId, code: input.code },
    "Couldn't verify that place.",
  );
}
