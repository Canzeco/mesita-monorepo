// Supabase Edge Function — visit-web-set-bill
//
// MESITA-3270: the shared visit, Bill, staff's half. Staff type the bill from the
// ticket and the guest's phone shows it to confirm. A changed bill needs confirming
// again. No sign-in. The guest holds the same link, so the place code is what proves
// this is the place; it has the close's wrong-try lock (place_visit_staff_check).
//
// Body: { place_id: uuid, code: "<32 hex>", place_code: "123456", bill_cents: integer }
// Response: { ok: true, ...the open visit } | { ok: false, code, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashPlaceCode, hashVisitCode, isBillCents, readPlaceCode, readVisitCode, VISIT_REFUSED } from "../_shared/place-visits.ts";

serveJson("visit-web-set-bill", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, bill_cents: billCents } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const code = readVisitCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "bad_code", error: VISIT_REFUSED.bad_code }, 409);
  const placeCode = readPlaceCode(bodyRes.body.place_code);
  if (!placeCode) return json({ ok: false, code: "bad_place_code", error: "The place code is six digits." }, 400);
  if (!isBillCents(billCents)) return json({ ok: false, code: "bad_bill", error: "Enter the amount." }, 400);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin.rpc("place_visit_set_bill", {
    p_place_id: placeId,
    p_code_hash: await hashVisitCode(placeId, code),
    p_place_code_hash: await hashPlaceCode(placeId, placeCode),
    p_bill_cents: billCents,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") {
    const outcome = String(data?.outcome);
    return json({ ok: false, code: outcome, error: VISIT_REFUSED[outcome] ?? "Couldn't save the bill." }, 409);
  }
  const { outcome: _outcome, ...visit } = data;
  return json({ ok: true, ...visit });
});
