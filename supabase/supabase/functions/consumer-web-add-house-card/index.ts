// Supabase Edge Function — consumer-web-add-house-card
//
// MESITA-3582: the place screen's "Add card to Wallet". Pins the place's
// House Card to the signed-in guest's Wallet with $0 (wallet_house_cards).
// Pinning twice is fine: it answers already: true and changes nothing.
//
// Body: { place_id: uuid }
// Response: { ok: true, already: boolean }
//   400 (not a place id) · 401 sign_in · 404 (no such place)
//   409 house_credits_off (MESITA-3610, Pato: "if the place doesn't enable
//   House Credits, the House Card cannot be enabled from the consumer app") · 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readSettings } from "../_shared/payments.ts";

serveJson("consumer-web-add-house-card", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to add a card" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const placeRes = await readVoucherPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (!placeRes.place) return json({ ok: false, error: "Place not found" }, 404);
  const settings = await readSettings(admin, placeId);
  if (!settings.house_credits) {
    return json({ ok: false, code: "house_credits_off", error: "This place doesn't use House Credits." }, 409);
  }

  const { data, error } = await admin
    .from("wallet_house_cards")
    .upsert({ consumer_id: user.id, place_id: placeId }, { onConflict: "consumer_id,place_id", ignoreDuplicates: true })
    .select("place_id");
  if (error) return json({ ok: false, error: `house_cards: ${error.message}` }, 500);
  const already = (data ?? []).length === 0;
  console.log("[consumer-web-add-house-card]", JSON.stringify({ outcome: already ? "already" : "added" }));
  return json({ ok: true, already });
});
