// Supabase Edge Function — consumer-web-take-back-credit
//
// MESITA-3292: the sender takes back a credit link nobody took yet. The
// credit returns to their balance at the same place, Available at once
// (wallet_take_back_gift); the link then gives nothing.
//
// Body: { gift_id: uuid }
// Response: { ok: true, outcome: "taken_back" | "already_taken_back",
//             gift_id, amount_cents, currency }
//   400 · 401 sign_in · 404 gone (not the caller's) · 409 claimed · 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { giftRefusalStatus } from "../_shared/gift.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-take-back-credit", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to take it back" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const giftId = bodyRes.body.gift_id;
  if (!isUuid(giftId)) return json({ ok: false, error: "gift_id must be a uuid" }, 400);

  const { data, error } = await admin.rpc("wallet_take_back_gift", { p_gift_id: giftId, p_sender_id: user.id });
  if (error) {
    console.error("[consumer-web-take-back-credit] rpc", error.message);
    return json({ ok: false, error: "Couldn't take it back. Try again." }, 500);
  }
  const res = data as { ok: boolean; code?: string; outcome?: string; gift_id?: string; amount_cents?: number; currency?: string };
  console.log("[consumer-web-take-back-credit]", JSON.stringify({ outcome: res.outcome ?? res.code }));
  if (!res.ok) {
    return json({
      ok: false,
      code: res.code,
      error: res.code === "claimed" ? "Your friend already took it" : "That link isn't yours",
    }, giftRefusalStatus(res.code));
  }
  return json({ ok: true, outcome: res.outcome, gift_id: res.gift_id, amount_cents: res.amount_cents, currency: res.currency });
});
