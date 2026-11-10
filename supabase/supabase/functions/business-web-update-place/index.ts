// Supabase Edge Function — business-web-update-place
//
// MESITA-3103. The Business app's profile save. The same save as admin's
// (`_shared/place-update-apply.ts`): an owner may write only the profile a
// guest reads (OWNER_WRITABLE_FIELDS; any other key is refused whole with
// `not_owner_field`); a super-admin writes as admin does. Anyone else: 404.
//
// Body: UpdateBody (`id` is the place)
// Response: { ok: true, place, familyStored }
//
// A save that changes the Instagram or Facebook link runs Update Reviews in
// the background (MESITA-3161).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { applyPlaceUpdate } from "../_shared/place-update-apply.ts";
import type { UpdateBody } from "../_shared/place-update.ts";
import { runInBackground } from "../_shared/background.ts";
import { runReviewsUpdate } from "../_shared/reviews-update.ts";

serveJson("business-web-update-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<UpdateBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.id;
  if (!isUuid(placeId)) return json({ ok: false, error: "id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  // A new Instagram or Facebook link runs Update Reviews (Pato, MESITA-3161:
  // "sync is triggered each time someone changes the facebook or instagram
  // link"), after the save answers. Compared with the row before the save.
  const body = bodyRes.body;
  const linkTouched = "instagram_url" in body || "facebook_url" in body;
  const { data: before } = linkTouched
    ? await admin.from("place_profiles").select("instagram_url, facebook_url").eq("id", placeId).maybeSingle()
    : { data: null };

  const res = await applyPlaceUpdate(admin, body, {
    actor: access.role === "superadmin" ? "admin" : "owner",
    userId: user.id,
    source: "business-web-update-place",
  });

  const norm = (v: unknown) => (typeof v === "string" ? v.trim() : "") || null;
  const changed = linkTouched && res.ok && (
    ("instagram_url" in body && norm(body.instagram_url) !== norm(before?.instagram_url)) ||
    ("facebook_url" in body && norm(body.facebook_url) !== norm(before?.facebook_url))
  );
  if (changed) {
    runInBackground(
      runReviewsUpdate(admin, placeId).then((r) => {
        if (!r.ok) console.error(`[business-web-update-place] the link change's Update Reviews did not run: ${r.error}`);
      }),
    );
  }
  return res;
});
