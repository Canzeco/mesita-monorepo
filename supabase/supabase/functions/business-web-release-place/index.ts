// Supabase Edge Function — business-web-release-place
//
// Returns a place from an organization to the PUBLIC POOL.
//
// Auth: OWNER of the holding organization. Not editor: release is how a
// place leaves, and an editor who could release could also re-claim it
// into an organization of their own — a hostile transfer with no owner
// involved.
//
// Release is a CONFIRMED, atomic act (release_place_from_org RPC):
// blocked while a Partnership subscription is genuinely live (active or
// past_due and not winding down — "Cancel Partnership first"), resets the
// plan to free so the next claimer inherits nothing paid, and deletes only
// TENURE-ERA membership rows (created at-or-after this claim; rows that
// predate the claim survive). The org keeps its Stripe account
// (MESITA-1545) — releasing still touches no Connect money.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";

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

  const { data: placeRow } = await admin
    .from("places")
    .select("organization_id")
    .eq("id", placeId)
    .maybeSingle();
  const holdingOrg = (placeRow as { organization_id: string | null } | null)?.organization_id ?? null;
  if (!holdingOrg) {
    return json(
      { ok: false, error: "That place is already public", code: "already_public" },
      409,
    );
  }

  const roleRes = await requireOrgRole(admin, authRes.user, holdingOrg, ["owner"]);
  if (!roleRes.ok) return roleRes.response;

  const { data, error } = await admin.rpc("release_place_from_org", {
    p_place_id: placeId,
    p_organization_id: holdingOrg,
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

  return json({ ok: true, place: { id: placeId, organization_id: null } });
});
