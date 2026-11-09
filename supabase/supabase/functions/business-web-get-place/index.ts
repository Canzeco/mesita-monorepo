// Supabase Edge Function — business-web-get-place
//
// MESITA-3103. The place as the Business app's profile editor paints it: the
// same one read as admin's Single Place (`_shared/place-overview.ts`). Whoever
// runs the place gets the profile; a super-admin also gets the internal
// fields (embedding, Enrich ladder, Profile Stats, owners and requests).
// Anyone else: 404.
//
// Body: { place_id: uuid }
// Response: { ok: true, role: "owner" | "superadmin", place, profile,
//             manager: { method, expires_at, role } | null,
//             code_set: boolean,   whether the place code is set (MESITA-3299), never the code
//             can_sell: boolean | null }  MESITA-3384: the place's Stripe account
//               charges in this server's mode (stripeStateOf "charging", the rule
//               the voucher sale reads); false draws the Connect nudge on
//               Payments and its dot in the menu; null when the read failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { buildPlaceOverview } from "../_shared/place-overview.ts";
import { anonymousReviews } from "../_shared/anonymous-reviews.ts";
import { boostLivemode } from "../_shared/boost.ts";
import { stripeStateByPlace } from "../_shared/payments.ts";

serveJson("business-web-get-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const res = await buildPlaceOverview(admin, placeId, { internal: access.role === "superadmin" });
  if (!res.ok) return json({ ok: false, error: res.error }, res.status);

  const { data: code, error: codeErr } = await admin.from("place_codes").select("place_id").eq("place_id", placeId).maybeSingle();
  if (codeErr) return json({ ok: false, error: `place_codes: ${codeErr.message}` }, 500);

  const stripe = await stripeStateByPlace(admin, [placeId], boostLivemode());

  return json({
    ok: true,
    role: access.role,
    // Reviews are anonymous here too (MESITA-3145, as for guests, MESITA-2916):
    // stars, comment and date; no reviewer name or photo reaches Business.
    place: { ...res.overview.place, google_reviews: anonymousReviews(res.overview.place.google_reviews) },
    profile: res.overview.profile,
    manager: access.manager ? { method: access.manager.method, expires_at: access.manager.expires_at, role: access.manager.role } : null,
    code_set: !!code,
    can_sell: stripe ? stripe.get(placeId) === "charging" : null,
  });
});
