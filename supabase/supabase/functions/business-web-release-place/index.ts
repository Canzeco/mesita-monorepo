// Supabase Edge Function — business-web-release-place
//
// Returns a claimed place to the PUBLIC POOL.
//
// Auth: OWNER of the place. Not editor: release is how a place leaves, and an
// editor who could release could also re-claim it as themselves — a hostile
// transfer with no owner involved. That law is unchanged by MESITA-1892; only
// what "owner" is proven against moved, from the holding organization's
// membership to the place's own `place_members` row.
//
// Release is a CONFIRMED, atomic act (release_place RPC): blocked while a
// Partnership subscription is genuinely live (active or past_due and not
// winding down — "Cancel Partnership first"), resets the plan to free so the
// next claimer inherits nothing paid, and deletes only TENURE-ERA membership
// rows (created at-or-after this claim; rows that predate the claim survive).
//
// WHAT RELEASE NOW CLEARS TOO. The merchant identity used to belong to the
// organization, which kept it (and its Stripe account — MESITA-1545) when a
// place was released. The place is the merchant now, so `partnered`,
// `legal_name`, `rfc` and `stripe_billing_customer_id` are wiped with the
// claim: they were the released operator's, and the operator is who just let
// go. The CONNECT account (`place_payment_accounts`) is deliberately NOT
// touched — releasing still moves no money and detaches no Stripe account.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOwner } from "../_shared/auth-membership.ts";

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

  // Rank BEFORE state: a stranger asking about a place they do not own must
  // not learn from the error whether it is claimed.
  const ownerRes = await requireOwner(admin, authRes.user, placeId);
  if (!ownerRes.ok) return ownerRes.response;

  // `claimed_at` is what a release undoes, and the RPC refuses a row without
  // it. Checking here buys the operator a sentence instead of a bare
  // race_lost. Note the case this covers beyond "already public": a place
  // owned the OLD way (created, then verified into an owner row) never passed
  // through the pool, so it has an owner and no claim — there is nothing to
  // release, and saying so is the honest answer.
  const { data: placeRow, error: readErr } = await admin
    .from("places")
    .select("claimed_at")
    .eq("id", placeId)
    .maybeSingle();
  if (readErr) return json({ ok: false, error: readErr.message }, 500);
  if (!placeRow) return json({ ok: false, error: "No such place" }, 404);
  if ((placeRow as { claimed_at: string | null }).claimed_at === null) {
    return json(
      {
        ok: false,
        error: "That place is not held through a claim — there is nothing to release.",
        code: "already_public",
      },
      409,
    );
  }

  const { data, error } = await admin.rpc("release_place", {
    p_place_id: placeId,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  const result = data as { ok: boolean; code?: string };

  if (!result.ok) {
    if (result.code === "subscription_live") {
      return json(
        {
          ok: false,
          error: "Cancel Partnership first — release is blocked while a subscription is live.",
          code: "subscription_live",
        },
        409,
      );
    }
    return json({ ok: false, error: "Release failed", code: "race_lost" }, 409);
  }

  return json({ ok: true, place: { id: placeId, claimedAt: null } });
});
