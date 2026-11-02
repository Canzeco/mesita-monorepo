// Supabase Edge Function — admin-web-get-overview
//
// Super-admin only. The full place row admin's Single Place edits
// (manage-single/[id]), plus the State facts its State and Crenup boxes read,
// in one round trip.
//
// WAS business-web-get-overview (MESITA-2090). That function served three
// readers — the deleted web-business sidebar, its Place screen, and, through
// its super-admin branch, this admin screen. MESITA-2089 deleted web-business,
// so only the
// super-admin branch survives, under the name of the one app that calls it:
// the EF name is the ACL (ef-caller-acl.test.ts). Gone with the business
// readers: the place_members branch, recent tickets, `rewardsConfig`, the
// Check PIN, and the Mesita Pay / Credits / orders acceptance bits — no admin
// screen reads any of them.
//
// Body:     { placeId }   (legacy aliases via readPlaceIdAlias)
// Response: { ok: true, isSuperAdmin: true, active: { place }, profile }
//           `active.place` is the AdminPlace. `profile` is the rest of the
//           same read: the stored Families resolved, the category
//           options (each with its family display), the tag catalog, and
//           the field limits. The profile page does not call another door.
// Auth:     caller must be in public.super_admins.
//
// The read itself is `_shared/place-overview.ts` (MESITA-3103), shared with
// business-web-get-place; admin always asks for the internal fields.
//
// Local:  supabase functions serve admin-web-get-overview
// Deploy: supabase functions deploy admin-web-get-overview

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, readPlaceIdAlias, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { buildPlaceOverview } from "../_shared/place-overview.ts";

type Body = {
  placeId?: string;
};

serveJson("admin-web-get-overview", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body) || null;
  if (!placeId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  const res = await buildPlaceOverview(admin, placeId, { internal: true });
  if (!res.ok) return json({ ok: false, error: res.error }, res.status);

  return json({
    ok: true,
    isSuperAdmin: true,
    active: { place: res.overview.place },
    profile: res.overview.profile,
  });
});
