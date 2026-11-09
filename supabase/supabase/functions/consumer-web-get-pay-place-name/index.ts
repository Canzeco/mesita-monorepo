// Supabase Edge Function — consumer-web-get-pay-place-name
//
// MESITA-3526: the Pay QR door. A signed-out guest who scans a table QR
// lands on sign-in with `?next=/pay?place=<id>`; this read lets that screen
// say "Sign in to pay at <name>". Public (no session yet) and deliberately
// narrow: it returns the place's name and nothing else, never whether the
// place takes payments. The anon client reads profiles, so the same RLS
// that gates the public catalog decides which places have a name here; an
// unknown or hidden place answers name: null, not a 404.
//
// Body: { place_id: uuid }
// Response: { ok: true, name: string | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { anonClient, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-get-pay-place-name", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const { data, error } = await anonClient(envRes.env)
    .from("profiles")
    .select("name")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);

  const name = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null;
  return json({ ok: true, name });
});
