// Supabase Edge Function — consumer-web-claim-credit
//
// MESITA-3292: a friend opens a credit link (<origin>/wallet/gift/<token>)
// signed in. With `look: true` it only reads the link: how much, at which
// place, whether it is still open, and whether it is the caller's own
// link. Without it, it takes the credit (wallet_claim_gift: once, never by
// the sender, never across test and live); the credit is Available at once
// at that place only.
//
// MESITA-3737: or the friend types the gift's 12-digit code in the Wallet
// ({ code }): it takes the credit at once, no look; five wrong codes an hour,
// then 429 too_many_tries (wallet_claim_gift_code).
//
// Body: { token: string (22 base64url), look?: true } | { code: string (12 digits) }
// Response (look): { ok: true, gift: { status: open | claimed | taken_back,
//                    amount_cents, currency, mine, yours,
//                    place: { id, slug, name, photo, boost_tier, mesita_pay } | null }, test_mode }
//   mine: the caller sent it; yours: the caller already took it.
// Response (claim): { ok: true, outcome: "claimed" | "already_claimed",
//                     gift_id, place_id, amount_cents, currency, test_mode }
//   400 · 401 sign_in · 404 gone · 409 claimed | taken_back | own_gift ·
//   429 too_many_tries · 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import {
  GIFT_CODE_MAX_MISSES,
  giftRefusalStatus,
  hashGiftCode,
  hashGiftToken,
  isGiftToken,
  readGiftCode,
} from "../_shared/gift.ts";
import { readWalletPlaces } from "../_shared/wallet.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

const REFUSAL: Record<string, string> = {
  gone: "That link isn't here.",
  claimed: "Someone already took this credit.",
  taken_back: "Your friend took this credit back.",
  own_gift: "This is your own link. Send it to a friend.",
  too_many_tries: "Too many wrong codes. Try again in an hour.",
};

serveJson("consumer-web-claim-credit", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to take this credit" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const livemode = paymentsLivemode();
  const token = bodyRes.body.token;
  const typed = bodyRes.body.code;
  if (typed !== undefined && token === undefined) {
    const code = readGiftCode(typed);
    if (!code) return json({ ok: false, error: "Type the 12 digits of the code" }, 400);
    const { data, error } = await admin.rpc("wallet_claim_gift_code", {
      p_code_hash: await hashGiftCode(code),
      p_recipient_id: userId,
      p_livemode: livemode,
      p_max_misses: GIFT_CODE_MAX_MISSES,
    });
    return answer(data, error, livemode, "code");
  }
  if (!isGiftToken(token)) return json({ ok: false, error: "token must be a credit link's key" }, 400);

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
  return answer(data, error, livemode, "link");
});

function answer(data: unknown, error: { message: string } | null, livemode: boolean, via: "link" | "code"): Response {
  if (error) {
    console.error("[consumer-web-claim-credit] rpc", error.message);
    return json({ ok: false, error: "Couldn't take the credit. Try again." }, 500);
  }
  const res = data as {
    ok: boolean; code?: string; outcome?: string; gift_id?: string; place_id?: string;
    amount_cents?: number; currency?: string; tries_left?: number;
  };
  console.log("[consumer-web-claim-credit]", JSON.stringify({ via, outcome: res.outcome ?? res.code }));
  if (!res.ok) {
    const error = via === "code" && res.code === "gone"
      ? "That code isn't right. Check the 12 digits."
      : (REFUSAL[res.code ?? ""] ?? "Couldn't take the credit");
    return json({
      ok: false,
      code: res.code,
      error,
      ...(res.tries_left !== undefined ? { tries_left: res.tries_left } : {}),
    }, giftRefusalStatus(res.code));
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
}
