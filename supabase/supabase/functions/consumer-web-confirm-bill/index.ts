// Supabase Edge Function — consumer-web-confirm-bill
//
// MESITA-3270: the shared visit, Bill, the guest's half. The guest signs the number
// staff typed. It names the number it saw, so a bill staff changed a moment ago is
// refused and shown again, never confirmed unseen. The close logs this number only.
//
// Body: { place_id: uuid, bill_cents: integer }
// Response: { ok: true, visit: { ...the open visit } } | { ok: false, code: "bill_changed", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { isBillCents } from "../_shared/place-visits.ts";

serveJson("consumer-web-confirm-bill", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, bill_cents: billCents } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (!isBillCents(billCents)) return json({ ok: false, error: "bill_cents must be an amount" }, 400);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin.rpc("place_visit_confirm_bill", {
    p_place_id: placeId,
    p_consumer_id: authRes.user.id,
    p_bill_cents: billCents,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") {
    return json({ ok: false, code: "bill_changed", error: "The bill changed. Check it again." }, 409);
  }
  const { outcome: _outcome, ...visit } = data;
  return json({ ok: true, visit });
});
