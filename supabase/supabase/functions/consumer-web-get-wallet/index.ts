// Supabase Edge Function — consumer-web-get-wallet
//
// MESITA-3097 / MESITA-3302 / MESITA-3303: the signed-in guest's Wallet —
// one balance per place they hold credit at, Available and Pending, with
// its history. Every open purchase of theirs is settled with Stripe first,
// on the purchase's own connected account (paid → credited, expired →
// closed), so money paid by a guest who never came back from Checkout shows
// the next time they look. Settling runs under one 3-second budget: past
// it the read answers anyway, names the purchases still open (`settling`),
// and the next read, the receiver or the cron (W2b) finishes them. With
// `session_id` (Checkout's return) it also says what happened to that one
// purchase (`outcome`).
//
// Body: { session_id?: string }
// Response: { ok: true, test_mode,
//             balances: [{ place: { id, slug, name, photo } | null, place_id, currency,
//                          balance_cents, available_cents, pending_cents, last_at,
//                          entries: [{ kind, amount_cents, at, pending }] }],
//             outcome?: "credited" | "already_paid" | "pending" | "expired" | "mismatch" | "none",
//             settling?: true, pending_purchases?: [purchase ids] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/boost.ts";
import {
  balancesOf,
  type Entry,
  type OpenPurchase,
  readWalletPlaces,
  settleAll,
  type SettleOutcome,
} from "../_shared/wallet.ts";

/** How long one read waits on Stripe for every open purchase together. */
const SETTLE_BUDGET_MS = 3000;

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
    .select("id, stripe_checkout_session_id, stripe_account_id, created_at, voucher")
    .eq("consumer_id", userId)
    .eq("livemode", livemode)
    .in("status", ["opening", "open"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (openErr) return json({ ok: false, error: `purchases: ${openErr.message}` }, 500);

  let outcome: SettleOutcome | "none" | undefined = sessionId ? "none" : undefined;
  let settling: string[] = [];
  const key = boostStripeKey();
  const purchases = (open ?? []) as OpenPurchase[];
  if (key && purchases.length > 0) {
    const res = await settleAll(admin, stripeClient(key), purchases, Date.now(), SETTLE_BUDGET_MS);
    settling = res.settling;
    if (sessionId) {
      const mine = purchases.find((p) => p.stripe_checkout_session_id === sessionId);
      if (mine) outcome = res.outcomes.get(mine.id) ?? "pending";
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
    .select("place_id, kind, amount_cents, currency, created_at, available_at")
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
    test_mode: !livemode,
    balances: balances.map(({ place_id, ...b }) => ({ place: places.get(place_id) ?? null, place_id, ...b })),
    ...(outcome === undefined ? {} : { outcome }),
    ...(settling.length > 0 ? { settling: true, pending_purchases: settling } : {}),
  });
});
