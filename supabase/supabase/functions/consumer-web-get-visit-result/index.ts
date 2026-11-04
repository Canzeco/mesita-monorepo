// Supabase Edge Function — consumer-web-get-visit-result
//
// MESITA-3256: the Reward sheet's Pay step. Staff close the visit on
// visit.mesita.ai and the server works out the discount; the guest's phone asks
// here until that result exists, then says what to pay the waiter. This guest's
// own visit only, at this place, since their code was first issued. A voided visit
// does not count. No money moves through Mesita.
//
// Body: { place_id: uuid, since: ISO time }
// Response: { ok: true, visit: { bill_cents, discount_cents, total_cents, currency } | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readSince } from "../_shared/place-visits.ts";

serveJson("consumer-web-get-visit-result", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const since = readSince(bodyRes.body.since);
  if (!since) return json({ ok: false, error: "since must be a time" }, 400);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin
    .from("place_visits")
    .select("bill_cents, discount_cents, total_cents, currency")
    .eq("place_id", placeId)
    .eq("consumer_id", authRes.user.id)
    .is("voided_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, visit: data });
});
