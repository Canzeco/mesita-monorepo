// Supabase Edge Function — consumer-web-claim-credit
//
// MESITA-3292: a friend opens a credit link (<origin>/wallet?gift=<token>)
// signed in. With `look: true` it only reads the link: how much, at which
// place, whether it is still open, and whether it is the caller's own
// link. Without it, it takes the credit (wallet_claim_gift: once, never by
// the sender, never across test and live); the credit is Available at once
// at that place only.
//
// Body: { token: string (22 base64url), look?: true }
// Response (look): { ok: true, gift: { status: open | claimed | taken_back,
//                    amount_cents, currency, mine, yours,
//                    place: { id, slug, name, photo, boost_tier, mesita_pay } | null }, test_mode }
//   mine: the caller sent it; yours: the caller already took it.
// Response (claim): { ok: true, outcome: "claimed" | "already_claimed",
//                     gift_id, place_id, amount_cents, currency, test_mode }
//   400 · 401 sign_in · 404 gone · 409 claimed | taken_back | own_gift · 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode } from "../_shared/boost.ts";
import { giftRefusalStatus, hashGiftToken, isGiftToken } from "../_shared/gift.ts";
import { readWalletPlaces } from "../_shared/wallet.ts";

const REFUSAL: Record<string, string> = {
  gone: "That link isn't here.",
  claimed: "Someone already took this credit.",
  taken_back: "Your friend took this credit back.",
  own_gift: "This is your own link. Send it to a friend.",
};

serveJson("consumer-web-claim-credit", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return json({ ok: false, code: "sign_in", error: "Sign in to take this credit" }, 401);
  const userId = authRes.user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isGiftToken(token)) return json({ ok: false, error: "token must be a credit link's key" }, 400);

  const admin = adminClient(envRes.env);
  const livemode = paymentsLivemode();
  const tokenHash = await hashGiftToken(token);

  if (bodyRes.body.look === true) {
    const { data: row, error } = await admin
      .from("wallet_gifts")
      .select("place_id, amount_cents, currency, status, sender_id, recipient_id, livemode")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) return json({ ok: false, error: `gift: ${error.message}` }, 500);
    const gift = row as {
      place_id: string; amount_cents: number; currency: string; status: string;
      sender_id: string | null; recipient_id: string | null; livemode: boolean;
    } | null;
    if (!gift || gift.livemode !== livemode) return json({ ok: false, code: "gone", error: REFUSAL.gone }, 404);
    const placesRes = await readWalletPlaces(admin, [gift.place_id]);
    return json({
      ok: true,
      gift: {
        status: gift.status,
        amount_cents: gift.amount_cents,
        currency: gift.currency,
        mine: gift.sender_id === userId,
        yours: gift.recipient_id === userId,
        place: placesRes.ok ? (placesRes.places.get(gift.place_id) ?? null) : null,
      },
      test_mode: !livemode,
    });
  }

  const { data, error } = await admin.rpc("wallet_claim_gift", {
    p_token_hash: tokenHash,
    p_recipient_id: userId,
    p_livemode: livemode,
  });
  if (error) {
    console.error("[consumer-web-claim-credit] rpc", error.message);
    return json({ ok: false, error: "Couldn't take the credit. Try again." }, 500);
  }
  const res = data as {
    ok: boolean; code?: string; outcome?: string; gift_id?: string; place_id?: string;
    amount_cents?: number; currency?: string;
  };
  console.log("[consumer-web-claim-credit]", JSON.stringify({ outcome: res.outcome ?? res.code }));
  if (!res.ok) {
    return json({ ok: false, code: res.code, error: REFUSAL[res.code ?? ""] ?? "Couldn't take the credit" }, giftRefusalStatus(res.code));
  }
  return json({
    ok: true,
    outcome: res.outcome,
    gift_id: res.gift_id,
    place_id: res.place_id,
    amount_cents: res.amount_cents,
    currency: res.currency,
    test_mode: !livemode,
  });
});
