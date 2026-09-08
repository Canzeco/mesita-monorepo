// Supabase Edge Function — consumer-web-cancel-credit-gift (MESITA-1677)
//
// Naming: caller-verb-words. Caller = consumer, verb = cancel, words =
// credit-gift.
//
// MONEY MUST NEVER BE STRANDABLE. A hashed code that was created and never
// shared is unrecoverable — the sender cannot get it back and nobody can
// claim it. Cancelling an UNCLAIMED gift returns its lot to the sender's own
// wallet (cancel_credit_gift, 20260908160648) — NOT a Stripe refund, because
// the organization already holds the funds; only who owns the resulting
// balance changes. Codes stay hashed throughout: recoverability comes from
// this cancel path, never from re-revealing the secret.
//
// Only the SENDER of a still-UNCLAIMED gift may cancel it — the RPC refuses
// identically for "already claimed", "already cancelled", and "not yours",
// so this EF cannot leak which case fired.
//
// Body:     { giftId: string }
// Response: { ok: true, lotId } | { ok: false, code: "gift_not_cancellable", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

type Body = { giftId?: unknown };

const NOT_CANCELLABLE =
  "That gift can't be cancelled — it may already be claimed or cancelled.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const giftId = typeof bodyRes.body.giftId === "string"
    ? bodyRes.body.giftId.trim()
    : "";
  if (!giftId) return json({ ok: false, error: "giftId is required" }, 400);

  const admin = adminClient(envRes.env);
  const result = await admin.rpc("cancel_credit_gift", {
    p_gift_id: giftId,
    p_sender_id: authRes.user.id,
  });
  if (result.error) {
    return json({
      ok: false,
      error: `credit_gift_cancel: ${result.error.message}`,
    }, 500);
  }
  const data = result.data as
    | { ok: boolean; lotId?: string; code?: string }
    | null;
  if (!data?.ok) {
    return json({
      ok: false,
      code: "gift_not_cancellable",
      error: NOT_CANCELLABLE,
    }, 409);
  }

  return json({ ok: true, lotId: data.lotId });
});
