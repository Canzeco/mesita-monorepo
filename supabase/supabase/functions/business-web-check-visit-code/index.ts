// Supabase Edge Function — business-web-check-visit-code
//
// MESITA-3202: Business › Visits. Who a guest's code belongs to and which
// rewards they may use here. Spends nothing. A code only works at the place it
// was made for, so a wrong guess finds nobody else's guest.
//
// Body: { place_id: uuid, code: "123456" }
// Response: { ok: true, guest: { name, member_number },
//             rewards: [{ kind, percent, cap_cents, eligible, reason }] }
//         | { ok: false, code: "bad_code", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashVisitCode, readVisitCode } from "../_shared/place-visits.ts";

serveJson("business-web-check-visit-code", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const code = readVisitCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "bad_code", error: "The code is six digits" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const { data, error } = await admin.rpc("place_visit_check", {
    p_place_id: placeId,
    p_code_hash: await hashVisitCode(placeId, code),
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") {
    return json({ ok: false, code: "bad_code", error: "That code isn't valid here. Ask the guest for a new one." }, 409);
  }
  return json({ ok: true, guest: data.guest, rewards: data.rewards });
});
