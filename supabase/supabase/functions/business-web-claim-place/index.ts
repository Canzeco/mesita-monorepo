// Supabase Edge Function — business-web-claim-place
//
// Takes a place out of the PUBLIC POOL and makes the caller its owner.
//
// IT USED TO FILE THE PLACE UNDER SOMETHING (MESITA-1892). The claim was a
// conditional UPDATE on `organization_id`, and the caller had to name an
// organization they owned. The organization layer is gone: a claim now writes
// `claimed_by`/`claimed_at` as provenance and mints the `place_members` owner
// row that IS the grant. Nothing is filed anywhere; the place holds itself.
//
// Ownership PROOF is still out of scope — a claim is an assertion, not a
// proof of it — but Verified is no longer a separate ceremony (MESITA-1690,
// reversing MESITA-1664's plan to make it one): a successful claim
// auto-writes an approved `place_verifications` row too, best-effort, below.
// "For the moment," per Pato — the mock-code Confirm button
// (business-web-verify-place) still exists as the catch-up path for a place
// claimed before this shipped, or for the rare claim whose auto-verify write
// failed. Two things matter about the claim itself:
//
//   1. The claim is a CONDITIONAL UPDATE (`claimed_at is null` in the WHERE
//      clause, inside `claim_place`), so two concurrent claims cannot both
//      win — the loser gets a 409 instead of silently overwriting.
//   2. The claimable predicate is shared with the listing
//      (_shared/place-claim.ts), so a place the list hides cannot be
//      claimed by guessing its id.
//
// AUTH: any signed-in business account. THIS IS NOT A WIDENING. The gate it
// replaces was "owner of the target organization", and an organization was
// something any signed-in account could create for itself in the same session
// (business-web-create-organization, now deleted) — so the role check proved
// only that the caller had made themselves a container first. The real gate
// was, and remains, the pool predicate: what stops you claiming is that
// somebody already owns the place, never who you are.
//
// THE PARTNER AUTO-JOIN IS GONE. A place claimed into a partnered
// organization used to inherit plan=pro Zero, because Partner was an org fact
// that cascaded onto everything it held. Partner is a fact about the PLACE
// now (`places.partnered`), so a freshly claimed place is simply not a
// partner yet — its new owner buys the yearly Mesita Membership
// (`business-web-start-membership`), which is the ONE door that writes the
// entitlement and is deliberately NOT Stripe-locked: Stripe has already taken
// the money by the time the webhook entitles anything. Nothing on the wire
// changes: the response never carried a partnership field.
//
// This named `business-web-set-partner-status` until MESITA-1897 — an endpoint
// that never existed. MESITA-1892 renamed the operator switch to it, then
// MESITA-1889 landed first and retired that switch outright, so the rename was
// dropped in the merge and the comment kept pointing at the name.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { writeApprovedVerification } from "../_shared/place-verification.ts";

type Body = { placeId?: string; projectId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);

  // ONE atomic database function does the guarded claim (`claimed_at is null`
  // is the lock) and the owner-row upsert together — supabase-js has no
  // transactions, and a claim without its owner row is the dead-end this whole
  // path exists to kill. The RPC honors the pool predicate (place-claim.ts's
  // two facts) and answers machine codes.
  const { data, error } = await admin.rpc("claim_place", {
    p_place_id: placeId,
    p_claimer: authRes.user.id,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  const result = data as { ok: boolean; code?: string; claimed_at?: string };

  if (!result.ok) {
    if (result.code === "not_claimable" || result.code === "owner_conflict") {
      return json(
        {
          ok: false,
          error: "That place is not in the public pool",
          code: "not_claimable",
        },
        409,
      );
    }
    return json(
      {
        ok: false,
        error: "That place was just claimed by someone else",
        code: "race_lost",
      },
      409,
    );
  }

  // AUTO-VERIFY ON CLAIM (MESITA-1690). Pato: "automatically verify for the
  // moment. if someone claims, automatically write as verified." Claiming
  // already writes Owned atomically above; this is best-effort and outside
  // that atomicity on purpose — a manager who claims fine but hits a
  // verification-write hiccup still holds the place, and the mock-code
  // Confirm button (business-web-verify-place) stays as the catch-up path.
  // `mock_code`/`auto` is the same shape that button writes, so a place
  // verified here and one verified by hand are indistinguishable rows.
  const verifyResult = await writeApprovedVerification(admin, {
    placeId,
    userId: authRes.user.id,
    userEmail: authRes.user.email ?? "",
    method: "mock_code",
    decidedVia: "auto",
  });
  if (!verifyResult.ok) {
    console.error("[claim-place] auto-verify:", verifyResult.error);
  }

  return json({
    ok: true,
    place: { id: placeId, claimedAt: result.claimed_at ?? null },
  });
});
