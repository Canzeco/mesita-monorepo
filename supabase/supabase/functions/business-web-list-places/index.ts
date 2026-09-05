// Supabase Edge Function — business-web-list-places
//
// Two scopes, one endpoint:
//   scope: "org"    — the places an organization holds (caller must be in it)
//   scope: "public" — the PUBLIC POOL, claimable by any organization
//
// This is the business-side replacement for reading the catalogue through
// admin-web-search-places, which is super-admin-only: an ordinary business
// account can now see the pool and its own places.
//
// The pool predicate lives in _shared/place-claim.ts and is shared with
// business-web-claim-place ON PURPOSE. If listing and claiming ever
// disagree, a stranger claims a place the listing correctly hid.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { placeIdsWithDirectOwner } from "../_shared/place-claim.ts";

type Body = {
  scope?: "org" | "public";
  organizationId?: string;
  query?: string;
  limit?: number;
};

const MAX_LIMIT = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const scope = body.scope === "org" ? "org" : "public";
  const limit = Math.min(Math.max(body.limit ?? 50, 1), MAX_LIMIT);
  const search = (body.query ?? "").trim();

  const admin = adminClient(envRes.env);

  let q = admin
    .from("projects")
    .select("id, organization_id, claimed_at, places!inner(name, address, zone)")
    .limit(limit);

  if (scope === "org") {
    const organizationId = body.organizationId;
    if (!organizationId) {
      return json({ ok: false, error: "organizationId is required for scope=org" }, 400);
    }
    // Reading an organization's portfolio is a membership fact: any role.
    const roleRes = await requireOrgRole(admin, authRes.user, organizationId, [
      "owner",
      "editor",
      "viewer",
    ]);
    if (!roleRes.ok) return roleRes.response;
    q = q.eq("organization_id", organizationId);
  } else {
    q = q.is("organization_id", null);
  }

  if (search) q = q.ilike("places.name", `%${search}%`);

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);

  type Row = {
    id: string;
    organization_id: string | null;
    claimed_at: string | null;
    places: { name: string; address: string | null; zone: string | null };
  };
  let rows = (data ?? []) as unknown as Row[];

  // A place with a direct project_members owner is NOT in the pool, even
  // with organization_id null — it has a real operator who claimed it the
  // old way. Zero such rows today; the guard is what keeps that true.
  if (scope === "public") {
    const owned = await placeIdsWithDirectOwner(admin);
    rows = rows.filter((r) => !owned.has(r.id));
  }

  return json({
    ok: true,
    scope,
    places: rows.map((r) => ({
      id: r.id,
      name: r.places.name,
      address: r.places.address,
      zone: r.places.zone,
      organizationId: r.organization_id,
      claimedAt: r.claimed_at,
    })),
  });
});
