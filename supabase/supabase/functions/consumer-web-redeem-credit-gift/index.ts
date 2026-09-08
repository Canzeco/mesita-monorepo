// Supabase Edge Function — consumer-web-redeem-credit-gift (MESITA-1677)
//
// Naming: caller-verb-words. Caller = consumer, verb = redeem, words =
// credit-gift.
//
// JWT-GATED, NOT PUBLIC — unlike the preview EF (gift-web-preview-code).
// RedeemClient.tsx lives inside (shell), behind the auth wall: "claiming
// credits a wallet, and a wallet needs an account" (MESITA-1692). A stranger
// with no account sees the PUBLIC landing page first; this EF is reached
// only after sign-in, with `?code=` forwarded into the Redeem screen.
//
// ONE CONDITIONAL UPDATE IS THE WHOLE CONCURRENCY STORY (MESITA-1677) — all
// of it lives in redeem_credit_gift (20260908160648), an RPC rather than two
// supabase-js calls: the code-claim and the lot handover happen in the same
// transaction, so a crash between them can never leave a gift marked claimed
// with the money nowhere. This EF's job is auth, rate limiting, code shaping,
// and turning the RPC's generic refusal into ONE generic HTTP response —
// copying consumer-web-claim-invite-code's deliberate non-differentiation:
// lost the race, already spent, expired, or cancelled all look identical to
// the caller.
//
// RATE-LIMITED BY IP, same sliding-window shape _shared/ticket-check.ts's
// isRateLimited already reads, pointed at credit_gift_redeem_events instead
// of ticket_check_events (money surface, own audit trail). This endpoint is
// authenticated, so a consumer_id rides every event too, but the limiter
// itself keys on IP — a signed-in attacker can still script many accounts
// against one IP, and per-IP is what actually slows a 10-digit guessing
// script down regardless of how many accounts sit behind it.
//
// Body:     { code: string }
// Response: { ok: true, lotId, organizationId, organizationName, creditedCents,
//              paidCents, bonusCents, note, expiresAt }
//         | { ok: false, code: "gift_invalid", error } (one generic outcome)
//         | 400 | 401 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { hashRequestIp } from "../_shared/ticket-check.ts";
import { hashGiftCode, isPlausibleGiftCode } from "../_shared/gift-code.ts";

type Body = { code?: unknown };

const GIFT_INVALID = "That code didn't work. Check it and try again.";

async function isRedeemRateLimited(
  admin: ReturnType<typeof adminClient>,
  ipHash: string | null,
  maxPerMinute: number,
): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("credit_gift_redeem_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return (count ?? 0) >= maxPerMinute;
}

async function logRedeemEvent(
  admin: ReturnType<typeof adminClient>,
  args: {
    ipHash: string | null;
    consumerId: string;
    event: "redeemed" | "redeem_failed";
  },
): Promise<void> {
  // Fire-and-forget: the audit trail must never fail a guest-facing action.
  await admin.from("credit_gift_redeem_events").insert({
    ip_hash: args.ipHash,
    consumer_id: args.consumerId,
    event: args.event,
  });
}

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
  const code = typeof bodyRes.body.code === "string"
    ? bodyRes.body.code.trim()
    : "";

  const admin = adminClient(envRes.env);
  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);

  // Rate-limited even before the plausibility check — unlike the public
  // check surface, this endpoint is authenticated, so the cost of a query
  // per attempt is already bounded by "have an account"; the limiter is
  // still the actual control against a signed-in script trying many codes.
  if (await isRedeemRateLimited(admin, ipHash, 20)) {
    return json({
      ok: false,
      error: "Too many attempts — wait a minute and try again.",
    }, 429);
  }

  if (!isPlausibleGiftCode(code)) {
    await logRedeemEvent(admin, {
      ipHash,
      consumerId: authRes.user.id,
      event: "redeem_failed",
    });
    return json({ ok: false, code: "gift_invalid", error: GIFT_INVALID }, 400);
  }

  const codeHash = await hashGiftCode(code, envRes.env.serviceKey);
  const result = await admin.rpc("redeem_credit_gift", {
    p_code_hash: codeHash,
    p_claimer_id: authRes.user.id,
  });
  if (result.error) {
    return json({
      ok: false,
      error: `credit_gift_redeem: ${result.error.message}`,
    }, 500);
  }
  const data = result.data as
    | { ok: boolean; lotId?: string; code?: string }
    | null;
  if (!data?.ok) {
    await logRedeemEvent(admin, {
      ipHash,
      consumerId: authRes.user.id,
      event: "redeem_failed",
    });
    // ONE generic outcome regardless of cause — see header.
    return json({ ok: false, code: "gift_invalid", error: GIFT_INVALID }, 404);
  }

  await logRedeemEvent(admin, {
    ipHash,
    consumerId: authRes.user.id,
    event: "redeemed",
  });

  // Won — shape the response from the lot + the (now-claimed) gift row so
  // RedeemClient can render "Credits added at <organization>" without a
  // second round trip.
  const [lotRow, giftRow] = await Promise.all([
    admin
      .from("credit_lots")
      .select("id, organization_id, paid_cents, bonus_cents, expires_at")
      .eq("id", data.lotId!)
      .maybeSingle(),
    admin
      .from("credit_gifts")
      .select("note")
      .eq("code_hash", codeHash)
      .maybeSingle(),
  ]);
  const lot = lotRow.data as
    | {
      id: string;
      organization_id: string;
      paid_cents: number;
      bonus_cents: number;
      expires_at: string;
    }
    | null;
  if (!lot) {
    // The RPC just committed this lot — an immediately-failed re-read is not
    // a case that should happen, but the claim itself already succeeded, so
    // this degrades to a minimal response rather than pretending the redeem
    // failed.
    return json({ ok: true, lotId: data.lotId, note: null });
  }
  const org = await admin
    .from("organizations")
    .select("name")
    .eq("id", lot.organization_id)
    .maybeSingle();
  const organizationName = (org.data as { name?: string } | null)?.name ??
    "Mesita";

  return json({
    ok: true,
    lotId: lot.id,
    organizationId: lot.organization_id,
    organizationName,
    paidCents: lot.paid_cents,
    bonusCents: lot.bonus_cents,
    creditedCents: lot.paid_cents + lot.bonus_cents,
    expiresAt: lot.expires_at,
    note: (giftRow.data as { note?: string | null } | null)?.note ?? null,
  });
});
