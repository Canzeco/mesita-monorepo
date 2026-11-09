// Supabase Edge Function — consumer-web-remove-house-card
//
// MESITA-3582: takes a pinned $0 House Card off the signed-in guest's
// Wallet. A card that holds money (Available or Pending) stays: it is shown
// by its entries, not the pin, so the pin is kept and the call answers 409
// has_credit. Removing a card that is not pinned answers ok.
//
// Body: { place_id: uuid }
// Response: { ok: true }
//   400 (not a place id) · 401 sign_in · 409 has_credit · 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode } from "../_shared/boost.ts";
import { balanceAt } from "../_shared/house-cards.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-remove-house-card", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to remove a card" }, 401);
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const admin = adminClient(envRes.env);
  const userId = authRes.user.id;
  const bal = await balanceAt(admin, userId, placeId, paymentsLivemode());
  if (!bal.ok) return json({ ok: false, error: bal.error }, 500);
  if (bal.cents !== 0) {
    return json({ ok: false, code: "has_credit", error: "This card has credit, so it stays in your Wallet" }, 409);
  }
  const { error } = await admin.from("wallet_house_cards").delete().eq("consumer_id", userId).eq("place_id", placeId);
  if (error) return json({ ok: false, error: `house_cards: ${error.message}` }, 500);
  console.log("[consumer-web-remove-house-card]", JSON.stringify({ outcome: "removed" }));
  return json({ ok: true });
});
