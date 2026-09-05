// Supabase Edge Function — business-web-release-place
//
// Returns a place from an organization to the PUBLIC POOL.
//
// Auth: OWNER of the holding organization. Not editor: release is how a
// place leaves, and an editor who could release could also re-claim it
// into an organization of their own — a hostile transfer with no owner
// involved.
//
// REFUSES while the place carries a live connected account. Whether the
// merchant of record is the place or the organization is unsettled
// (place_payment_accounts is keyed by place today; the product decided the
// organization is the merchant on 2026-09-05). Until that lands, moving a
// place mid-settlement is the one irreversible thing here, so it is
// blocked rather than warned about.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { writePlace } from "../_shared/place-doc.ts";

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

  const { data: proj } = await admin
    .from("projects")
    .select("organization_id")
    .eq("id", placeId)
    .maybeSingle();
  const holdingOrg = (proj as { organization_id: string | null } | null)?.organization_id ?? null;
  if (!holdingOrg) {
    return json(
      { ok: false, error: "That place is already public", code: "already_public" },
      409,
    );
  }

  const roleRes = await requireOrgRole(admin, authRes.user, holdingOrg, ["owner"]);
  if (!roleRes.ok) return roleRes.response;

  const { data: pay } = await admin
    .from("place_payment_accounts")
    .select("charges_enabled")
    .eq("place_id", placeId)
    .maybeSingle();
  if ((pay as { charges_enabled?: boolean } | null)?.charges_enabled) {
    return json(
      {
        ok: false,
        error: "This place takes payments. Disconnect payments before releasing it.",
        code: "payments_live",
      },
      409,
    );
  }

  // Through the projects write door, guarded on the organization that
  // held it a moment ago — so a concurrent release/claim cannot make this
  // one release a place out of somebody else's portfolio.
  const res = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: placeId,
    guard: { organization_id: holdingOrg },
    patch: { organization_id: null, claimed_by: null, claimed_at: null },
    select: "id, organization_id",
    selectMode: "maybeSingle",
  });

  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  if (!res.row) return json({ ok: false, error: "Release failed", code: "race_lost" }, 409);

  return json({ ok: true, place: res.row });
});
