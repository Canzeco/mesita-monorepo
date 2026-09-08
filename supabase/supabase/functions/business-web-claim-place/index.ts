// Supabase Edge Function — business-web-claim-place
//
// Moves a place out of the PUBLIC POOL into an organization.
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
//   1. The claim is a CONDITIONAL UPDATE (`organization_id is null` in the
//      WHERE clause), so two concurrent claims cannot both win — the loser
//      gets a 409 instead of silently overwriting.
//   2. The claimable predicate is shared with the listing
//      (_shared/place-claim.ts), so a place the list hides cannot be
//      claimed by guessing its id.
//
// Auth: OWNER of the TARGET organization (MESITA-1537 gate C2). Claiming
// now MINTS place ownership — the claimer's project_members owner row is
// written atomically with the claim (claim_place_into_org RPC), which is
// what unlocks the funnel's owner-gated features (PIN, Partnership,
// transfer). An ownership ceremony is owner-only, same law as
// add-org-member; editors see an explained disabled state in the console.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { writeApprovedVerification } from "../_shared/place-verification.ts";

type Body = { placeId?: string; projectId?: string; organizationId?: string };

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
  const organizationId = body.organizationId;
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (!organizationId) {
    return json({ ok: false, error: "organizationId is required" }, 400);
  }

  const admin = adminClient(envRes.env);

  const roleRes = await requireOrgRole(admin, authRes.user, organizationId, [
    "owner",
  ]);
  if (!roleRes.ok) return roleRes.response;

  // ONE atomic database function does the guarded claim (organization_id
  // IS NULL is the lock) and the owner-row upsert together — supabase-js
  // has no transactions, and a claim without its owner row is the dead-end
  // this whole path exists to kill. The RPC honors the pool predicate
  // (place-claim.ts's two facts) and answers machine codes.
  const { data, error } = await admin.rpc("claim_place_into_org", {
    p_place_id: placeId,
    p_organization_id: organizationId,
    p_claimer: authRes.user.id,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  const result = data as { ok: boolean; code?: string };

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
    place: { id: placeId, organization_id: organizationId },
  });
});
