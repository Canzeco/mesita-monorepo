// Supabase Edge Function — gift-web-preview-code (MESITA-1677)
//
// THE PUBLIC HALF OF GIFTING. "auth-optional" is not a thing — verify_jwt is
// a gateway setting, all-or-nothing per function (config.toml). The house's
// existing public surface (validate-web-*) is possession auth for a DIFFERENT
// actor (staff/whoever holds a freshly scanned ticket QR); a stranger holding
// a gift code is a different actor again, so this gets its own prefix,
// gift-web-*, shaped exactly like validate-web-* — verify_jwt=false, the code
// itself is the whole authentication, money-path-efs.smoke.test.ts's
// PUBLIC_CHECK_EFS list is where the contract is pinned.
//
// WHAT THIS RENDERS, IN ORDER (the issue's own instruction): org identity
// leads, then the amount. "If the lot is still pending, say so before they
// accept" — checked here via the lot's own activates_at, even though nothing
// can actually be pending today (consumer-web-buy-credits' "CREDITS ACTIVATE
// IMMEDIATELY" decision applies here too, since redeem_credit_gift sets
// activates_at=now the moment it claims). Kept anyway: forward-compatible if
// the hold ever returns, and it is one boolean, not a feature.
//
// NO ORG LOGO — A KNOWN LIMITATION, FLAGGED. organizations has no logo/photo
// column at all (checked directly against the schema before writing this);
// adding one is an asset-pipeline/Design decision this issue does not scope.
// The landing page renders a text monogram from organizationName instead.
//
// CLAIMED/CANCELLED CODES ARE NOT A UNIFORM MISS, DELIBERATELY — the one
// place this EF diverges from validate-web's strict non-differentiation. A
// past recipient re-opening an old link deserves "this was already claimed",
// not a bare 404 that reads as broken. This does cost a small amount of
// enumeration resistance (an attacker can learn "this code exists" for a
// dead code) — accepted, because the codespace is 9e9 keyed-HMAC digests and
// this endpoint is rate-limited regardless. redeem_credit_gift itself (the
// EF that actually moves money) keeps the strict non-differentiation the
// issue explicitly asks for; this preview never touches state.
//
// Body:     { code: string }
// Response: { ok: true, gift: { state: "unclaimed", organizationName, paidCents,
//               bonusCents, creditedCents, note, pending, expiresAt } }
//         | { ok: true, gift: { state: "claimed" | "cancelled" } } (no amounts)
//         | 404 uniform miss (unknown/implausible code) | 405 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { hashRequestIp } from "../_shared/ticket-check.ts";
import { hashGiftCode, isPlausibleGiftCode } from "../_shared/gift-code.ts";

type Body = { code?: unknown };

function notFound(): Response {
  return json({ ok: false, error: "Gift not found" }, 404);
}

async function isPreviewRateLimited(
  admin: ReturnType<typeof adminClient>,
  ipHash: string | null,
): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("credit_gift_redeem_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  // Generous relative to redeem's own 20/min — a landing page can legitimately
  // reload or be revisited, and a preview never moves money.
  return (count ?? 0) >= 40;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = typeof bodyRes.body.code === "string"
    ? bodyRes.body.code.trim()
    : "";
  if (!code) return notFound();

  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);
  if (await isPreviewRateLimited(admin, ipHash)) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  // Plausibility BEFORE any DB work — same posture as
  // _shared/ticket-check.ts's isPlausibleCheckCode.
  if (!isPlausibleGiftCode(code)) return notFound();

  const codeHash = await hashGiftCode(code, envRes.env.serviceKey);
  const giftRes = await admin
    .from("credit_gifts")
    .select("id, lot_id, state, note, expires_at")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (giftRes.error) {
    return json(
      { ok: false, error: `gift_preview: ${giftRes.error.message}` },
      500,
    );
  }
  const gift = giftRes.data as
    | {
      id: string;
      lot_id: string;
      state: string;
      note: string | null;
      expires_at: string;
    }
    | null;
  if (!gift) {
    await admin.from("credit_gift_redeem_events").insert({
      ip_hash: ipHash,
      event: "preview",
    });
    return notFound();
  }

  await admin.from("credit_gift_redeem_events").insert({
    ip_hash: ipHash,
    event: "preview",
  });

  // See header — claimed/cancelled are told apart from unknown, but not from
  // EACH OTHER'S amounts: no money terms leak once the code is dead.
  if (gift.state !== "unclaimed") {
    return json({ ok: true, gift: { state: gift.state } });
  }

  const lotRes = await admin
    .from("credit_lots")
    .select("organization_id, paid_cents, bonus_cents, activates_at")
    .eq("id", gift.lot_id)
    .maybeSingle();
  if (lotRes.error || !lotRes.data) {
    return json({ ok: false, error: "gift_preview: lot not found" }, 500);
  }
  const lot = lotRes.data as {
    organization_id: string;
    paid_cents: number;
    bonus_cents: number;
    activates_at: string;
  };
  const orgRes = await admin
    .from("organizations")
    .select("name")
    .eq("id", lot.organization_id)
    .maybeSingle();
  const organizationName = (orgRes.data as { name?: string } | null)?.name ??
    "Mesita";

  return json({
    ok: true,
    gift: {
      state: "unclaimed",
      organizationName,
      paidCents: lot.paid_cents,
      bonusCents: lot.bonus_cents,
      creditedCents: lot.paid_cents + lot.bonus_cents,
      note: gift.note,
      // "If the lot is still pending, say so before they accept." See header
      // — always false today (no hold), kept for the day one returns.
      pending: new Date(lot.activates_at).getTime() > Date.now(),
      expiresAt: gift.expires_at,
    },
  });
});
