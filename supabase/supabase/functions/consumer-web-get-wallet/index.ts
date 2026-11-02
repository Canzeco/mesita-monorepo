// Supabase Edge Function — consumer-web-get-wallet
//
// MESITA-3097: the signed-in guest's Wallet — one balance per place they
// prepaid at, with its history. Every open purchase of theirs is settled
// with Stripe first (paid → credited, expired → closed), so money paid by a
// guest who never came back from Checkout shows the next time they look.
// With `session_id` (Checkout's return, `?prepay=`) it also says what
// happened to that one purchase (`outcome`).
//
// Body: { session_id?: string }
// Response: { ok: true,
//             balances: [{ place: { id, slug, name, photo } | null, currency,
//                          balance_cents, last_at, entries: [{ kind, amount_cents, at }] }],
//             presets: Record<currency, number[]>,
//             outcome?: "credited" | "already_paid" | "pending" | "expired" | "mismatch" | "none" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/boost.ts";
import {
  balancesOf,
  type Entry,
  type OpenPurchase,
  PREPAY_PRESETS,
  readWalletPlaces,
  type SettleOutcome,
  settlePurchase,
} from "../_shared/wallet.ts";

serveJson("consumer-web-get-wallet", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const body = await readJsonOr<Record<string, unknown>>(req, {});
  const sessionId = typeof body.session_id === "string" ? body.session_id : null;

  const admin = adminClient(envRes.env);
  const livemode = boostLivemode();

  // ── Settle what is still open ──────────────────────────────────────────
  const { data: open, error: openErr } = await admin
    .from("wallet_purchases")
    .select("id, stripe_checkout_session_id, created_at")
    .eq("consumer_id", userId)
    .eq("livemode", livemode)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(20);
  if (openErr) return json({ ok: false, error: `purchases: ${openErr.message}` }, 500);

  let outcome: SettleOutcome | "none" | undefined = sessionId ? "none" : undefined;
  const key = boostStripeKey();
  if (key && (open ?? []).length > 0) {
    const stripe = stripeClient(key);
    const now = Date.now();
    for (const p of (open ?? []) as OpenPurchase[]) {
      try {
        const o = await settlePurchase(admin, stripe, p, now);
        if (sessionId && p.stripe_checkout_session_id === sessionId) outcome = o;
      } catch (err) {
        // The guest sees the purchase as pending; the next read settles it.
        console.error("[consumer-web-get-wallet] settle", p.id, String(err));
        if (sessionId && p.stripe_checkout_session_id === sessionId) outcome = "pending";
      }
    }
  }
  if (sessionId && outcome === "none") {
    // Settled already (a reload of the return page).
    const { data: done } = await admin
      .from("wallet_purchases")
      .select("status")
      .eq("consumer_id", userId)
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (done?.status === "paid") outcome = "already_paid";
    else if (done?.status === "expired") outcome = "expired";
  }

  // ── Balances ───────────────────────────────────────────────────────────
  const { data: rows, error: entriesErr } = await admin
    .from("wallet_entries")
    .select("place_id, kind, amount_cents, currency, created_at")
    .eq("consumer_id", userId)
    .eq("livemode", livemode)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (entriesErr) return json({ ok: false, error: `entries: ${entriesErr.message}` }, 500);
  const balances = balancesOf((rows ?? []) as Entry[]);

  const placesRes = await readWalletPlaces(admin, [...new Set(balances.map((b) => b.place_id))]);
  if (!placesRes.ok) return json({ ok: false, error: placesRes.error }, 500);
  const places = placesRes.places;

  return json({
    ok: true,
    balances: balances.map(({ place_id, ...b }) => ({ place: places.get(place_id) ?? null, place_id, ...b })),
    presets: PREPAY_PRESETS,
    ...(outcome === undefined ? {} : { outcome }),
  });
});
