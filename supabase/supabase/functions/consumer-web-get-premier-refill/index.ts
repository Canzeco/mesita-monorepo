// Supabase Edge Function — consumer-web-get-premier-refill
//
// MESITA-3168: a place's Premier as the place screen's Premier tab shows it —
// its level, the Refill days running and queued (who gave them: Mesita, a
// code, a guest), the Subscription period running, and the two Refill packs
// with what each would do now (`available`, `code`, `notice`). For a
// signed-in guest it first settles their own open purchases on this place
// with Stripe (paid → days added, expired → closed); with `session_id`
// (Checkout's return, `?refill=`) it says what happened to that purchase.
// Signed out, it is the read alone.
//
// `owner` (MESITA-3203) is who runs the place, for the sheet's ownership box:
// "you" (the caller holds a live seat), "other" (someone else owns it), "none".
// Never who: every guest reads this, so no name or email leaves here.
//
// Body: { place_id: uuid, session_id?: string }
// Response: { ok: true, level: 0 | 1 | 2, signed_in: boolean,
//             owner: "none" | "you" | "other",
//             refill: [{ tier, starts_at, ends_at, source: "admin" | "code" | "purchase" }],
//             subscription: { tier, ends_at } | null,
//             packs: [{ tier, days, price_cents, currency, available, code?, notice? }],
//             purchase?: { status, line, tier, ends_at } | null }
// purchase.status: open · expired · paid · granted · refunded · refund_needed.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { getOptionalAuthedUser } from "../_shared/auth.ts";
import { PREMIER_CURRENCY } from "../_shared/boost.ts";
import { isLiveManager, MANAGER_COLUMNS, type ManagerRow } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import {
  checkRefill,
  PURCHASE_COLUMNS,
  purchaseLine,
  REFILL_PACK_CENTS,
  REFILL_PACK_DAYS,
  type RefillPurchase,
  refillNotice,
  type RefillTier,
  settleRefillPurchase,
} from "../_shared/premier-purchase.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-get-premier-refill", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const { user } = await getOptionalAuthedUser(req, env);

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const sessionId = typeof bodyRes.body.session_id === "string" ? bodyRes.body.session_id : null;

  const livemode = boostLivemode();

  // ── The guest's own purchases here, settled first ───────────────────────
  let purchase: { status: string; line: string; tier: number; ends_at: string | null } | null | undefined;
  if (user) {
    const { data: mine, error: mineErr } = await admin
      .from("premier_refill_purchases")
      .select(PURCHASE_COLUMNS)
      .eq("consumer_id", user.id)
      .eq("place_id", placeId)
      .eq("livemode", livemode)
      .in("status", ["open", "paid"])
      .order("created_at", { ascending: true })
      .limit(5);
    if (mineErr) return json({ ok: false, error: `purchases: ${mineErr.message}` }, 500);
    const key = boostStripeKey();
    if (key && (mine ?? []).length > 0) {
      const stripe = stripeClient(key);
      const now = Date.now();
      for (const p of (mine ?? []) as RefillPurchase[]) {
        try {
          await settleRefillPurchase(admin, stripe, p, now);
        } catch (err) {
          // The guest sees the purchase as it stands; the next read or the
          // cron sweep settles it.
          console.error("[consumer-web-get-premier-refill] settle", p.id, String(err));
        }
      }
    }
    if (sessionId) {
      const { data: back, error: backErr } = await admin
        .from("premier_refill_purchases")
        .select(PURCHASE_COLUMNS)
        .eq("consumer_id", user.id)
        .eq("place_id", placeId)
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();
      if (backErr) return json({ ok: false, error: `purchase: ${backErr.message}` }, 500);
      const p = back as RefillPurchase | null;
      purchase = p ? { status: p.status, line: purchaseLine(p), tier: p.tier, ends_at: p.ends_at } : null;
    }
  }

  // ── The place's Premier now ─────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const [checks, rowsRes, periodRes, managersRes] = await Promise.all([
    Promise.all(([1, 2] as RefillTier[]).map((t) => checkRefill(admin, placeId, t))),
    admin
      .from("place_manual_premier")
      .select("tier, starts_at, ends_at, source")
      .eq("place_id", placeId)
      .gt("ends_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(50),
    admin
      .from("place_premier_periods")
      .select("tier, starts_at, ends_at")
      .eq("place_id", placeId)
      .eq("status", "paid")
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1),
    admin.from("place_managers").select(MANAGER_COLUMNS).eq("place_id", placeId).is("revoked_at", null),
  ]);
  if (rowsRes.error) return json({ ok: false, error: `refill: ${rowsRes.error.message}` }, 500);
  if (periodRes.error) return json({ ok: false, error: `subscription: ${periodRes.error.message}` }, 500);
  if (managersRes.error) return json({ ok: false, error: `managers: ${managersRes.error.message}` }, 500);
  if (checks[0].result !== "ok" && checks[0].code === "not_found") {
    return json({ ok: false, code: "not_found", error: "This place isn't on Mesita yet." }, 404);
  }

  // A zero-length row is an ended grant kept for replay: never shown.
  const refill = ((rowsRes.data ?? []) as Array<{ tier: number; starts_at: string; ends_at: string; source: string }>)
    .filter((r) => r.ends_at > r.starts_at);
  const period = ((periodRes.data ?? []) as Array<{ tier: number; ends_at: string }>)[0] ?? null;
  const seats = ((managersRes.data ?? []) as unknown as ManagerRow[]).filter((r) => isLiveManager(r));
  const owner = user && seats.some((r) => r.consumer_id === user.id)
    ? "you"
    : seats.some((r) => r.role === "owner")
    ? "other"
    : "none";

  return json({
    ok: true,
    level: checks[0].level,
    signed_in: user != null,
    owner,
    refill,
    subscription: period ? { tier: period.tier, ends_at: period.ends_at } : null,
    packs: ([1, 2] as RefillTier[]).map((tier, i) => {
      const c = checks[i];
      const notice = refillNotice(c, tier);
      return {
        tier,
        days: REFILL_PACK_DAYS,
        price_cents: REFILL_PACK_CENTS[tier],
        currency: PREMIER_CURRENCY,
        available: c.result === "ok",
        ...(c.result === "ok" ? {} : { code: c.code }),
        ...(notice ? { notice } : {}),
      };
    }),
    ...(purchase === undefined ? {} : { purchase }),
  });
});
