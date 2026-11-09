// Supabase Edge Function — consumer-web-add-house-card
//
// MESITA-3582: the place screen's "Add card to Wallet". Pins the place's
// House Card to the signed-in guest's Wallet with $0 (wallet_house_cards).
// Pinning twice is fine: it answers already: true and changes nothing.
//
// Body: { place_id: uuid }
// Response: { ok: true, already: boolean }
//   400 (not a place id) · 401 sign_in · 404 (no such place) · 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";

serveJson("consumer-web-add-house-card", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to add a card" }, 401);
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const admin = adminClient(envRes.env);
  const placeRes = await readVoucherPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (!placeRes.place) return json({ ok: false, error: "Place not found" }, 404);

  const { data, error } = await admin
    .from("wallet_house_cards")
    .upsert({ consumer_id: authRes.user.id, place_id: placeId }, { onConflict: "consumer_id,place_id", ignoreDuplicates: true })
    .select("place_id");
  if (error) return json({ ok: false, error: `house_cards: ${error.message}` }, 500);
  const already = (data ?? []).length === 0;
  console.log("[consumer-web-add-house-card]", JSON.stringify({ outcome: already ? "already" : "added" }));
  return json({ ok: true, already });
});
