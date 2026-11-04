// Supabase Edge Function — visit-web-get-visit
//
// MESITA-3240: visit.mesita.ai, the page a guest's QR opens. Who the guest is and
// what they can use here. No sign-in: the link's secret is the key, 128 random
// bits, ten minutes, one use. Spends nothing.
//
// Body: { place_id: uuid, code: "<32 hex>" }
// Response: { ok: true, place_name, currency, code_set, guest_name, bill_cents,
//             rewards: [{ kind, percent, cap_cents }] }
//         | { ok: false, code: "bad_code", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashVisitCode, readVisitCode } from "../_shared/place-visits.ts";

const ENDED = "This QR has ended. Ask the guest to open it again.";

serveJson("visit-web-get-visit", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  const code = readVisitCode(bodyRes.body.code);
  if (!isUuid(placeId) || !code) return json({ ok: false, code: "bad_code", error: ENDED }, 409);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin.rpc("place_visit_open", {
    p_place_id: placeId,
    p_code_hash: await hashVisitCode(placeId, code),
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") return json({ ok: false, code: "bad_code", error: ENDED }, 409);

  return json({
    ok: true,
    place_name: data.place_name ?? "This place",
    currency: data.currency,
    code_set: data.code_set,
    guest_name: data.guest_name ?? "Guest",
    bill_cents: data.bill_cents ?? null,
    rewards: data.rewards,
  });
});
