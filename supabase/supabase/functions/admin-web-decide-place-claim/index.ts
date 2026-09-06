// Supabase Edge Function — admin-web-decide-place-claim
//
// MESITA-1544: a super-admin clears a pool claim off the review queue.
//
//   clear    -> stamps claim_reviewed_at/by. Ownership is untouched — this
//               is "I looked, it's a real operator," nothing more.
//   reverse  -> calls release_place_from_org (same RPC business-web-
//               release-place uses): the place drops back to the public
//               pool, the claimer's owner row from this tenure is deleted,
//               plan resets to free. Blocked while a Partnership
//               subscription is genuinely live, same as the business path
//               — an admin reversal is not a way around that guard.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = {
  placeId?: string;
  decision?: "clear" | "reverse";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const adminUserId = authRes.user.id;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = (bodyRes.body.placeId ?? "").trim();
  const decision = bodyRes.body.decision;
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (decision !== "clear" && decision !== "reverse") {
    return json({ ok: false, error: "decision must be 'clear' or 'reverse'" }, 400);
  }

  const { data: proj, error: lookupError } = await admin
    .from("projects")
    .select("organization_id, claimed_by, claim_reviewed_at")
    .eq("id", placeId)
    .maybeSingle();
  if (lookupError) {
    return json({ ok: false, error: `claim_lookup: ${lookupError.message}` }, 500);
  }
  const row = proj as { organization_id: string | null; claimed_by: string | null; claim_reviewed_at: string | null } | null;
  if (!row || !row.organization_id || !row.claimed_by) {
    return json({ ok: false, error: "That place has no active claim", code: "not_claimed" }, 409);
  }
  if (row.claim_reviewed_at) {
    return json({ ok: false, error: "That claim is already reviewed", code: "already_decided" }, 409);
  }

  if (decision === "clear") {
    const { error } = await admin
      .from("projects")
      .update({ claim_reviewed_at: new Date().toISOString(), claim_reviewed_by: adminUserId })
      .eq("id", placeId)
      .is("claim_reviewed_at", null);
    if (error) return json({ ok: false, error: `claim_clear: ${error.message}` }, 500);
    return json({ ok: true, decision: "clear" });
  }

  const { data, error } = await admin.rpc("release_place_from_org", {
    p_place_id: placeId,
    p_organization_id: row.organization_id,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  const result = data as { ok: boolean; code?: string };
  if (!result.ok) {
    if (result.code === "subscription_live") {
      return json(
        {
          ok: false,
          error: "Cannot reverse — a Partnership subscription is live on this place. Cancel it first.",
          code: "subscription_live",
        },
        409,
      );
    }
    return json({ ok: false, error: "Reversal failed", code: "race_lost" }, 409);
  }
  return json({ ok: true, decision: "reverse" });
});
