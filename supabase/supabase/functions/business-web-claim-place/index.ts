// Supabase Edge Function — business-web-claim-place
//
// Moves a place out of the PUBLIC POOL into an organization.
//
// Ownership verification is deliberately out of scope right now, so this
// is an assertion rather than a proof. Two things therefore matter:
//
//   1. The claim is a CONDITIONAL UPDATE (`organization_id is null` in the
//      WHERE clause), so two concurrent claims cannot both win — the loser
//      gets a 409 instead of silently overwriting.
//   2. The claimable predicate is shared with the listing
//      (_shared/place-claim.ts), so a place the list hides cannot be
//      claimed by guessing its id.
//
// Auth: owner or editor of the TARGET organization. A viewer may read the
// portfolio but may not enlarge it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOrgRole } from "../_shared/org-membership.ts";
import { isPlaceClaimable } from "../_shared/place-claim.ts";
import { writePlace } from "../_shared/place-doc.ts";

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
    "editor",
  ]);
  if (!roleRes.ok) return roleRes.response;

  if (!(await isPlaceClaimable(admin, placeId))) {
    return json(
      { ok: false, error: "That place is not in the public pool", code: "not_claimable" },
      409,
    );
  }

  // Through the projects write door (_shared/place-doc.ts), never
  // `.from("projects")` directly — write-surface.test.ts ratchets that.
  //
  // The guard IS the lock: `organization_id: null` renders as IS NULL, so
  // whoever writes first wins and the second caller updates zero rows and
  // is told, instead of silently overwriting the winner.
  const res = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: placeId,
    guard: { organization_id: null },
    patch: {
      organization_id: organizationId,
      claimed_by: authRes.user.id,
      claimed_at: new Date().toISOString(),
    },
    select: "id, organization_id, claimed_at",
    selectMode: "maybeSingle",
  });

  if (!res.ok) return json({ ok: false, error: res.error }, 500);
  if (!res.row) {
    return json(
      { ok: false, error: "That place was just claimed by someone else", code: "race_lost" },
      409,
    );
  }

  return json({ ok: true, place: res.row });
});
