// Supabase Edge Function — business-web-update-place
//
// MESITA-3103. The Business app's profile save. The same save as admin's
// (`_shared/place-update-apply.ts`): an owner may write only the profile a
// guest reads (OWNER_WRITABLE_FIELDS; any other key is refused whole with
// `not_owner_field`); a super-admin writes as admin does. Anyone else: 404.
//
// Body: UpdateBody (`id` is the place)
// Response: { ok: true, place, familyStored }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { applyPlaceUpdate } from "../_shared/place-update-apply.ts";
import type { UpdateBody } from "../_shared/place-update.ts";

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

  return await applyPlaceUpdate(admin, bodyRes.body, {
    actor: access.role === "superadmin" ? "admin" : "owner",
    userId: user.id,
    source: "business-web-update-place",
  });
});
