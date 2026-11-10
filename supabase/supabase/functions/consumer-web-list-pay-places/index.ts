// Supabase Edge Function — consumer-web-list-pay-places
//
// MESITA-3457: the Pay tab's list. The places a signed-in guest can pay at
// now: where they hold credit (any switch, MESITA-3408) and where Mesita Payments
// takes a card part (`card_ok`), nearest first (MESITA-3536). Which
// card places are listed, the radius and the cap are _shared/pay-places.ts.
// consumer-web-start-payment is unchanged: this only lists.
//
// The location is used for distance and dropped: never stored, never
// logged, and neither is the body.
//
// Body: { lat?: number, lng?: number } (the client rounds to 3 decimals)
// Response: { ok: true, places: [{ place_id, name, photo, address, marks: { tier, mesita_pay },
//             distance_m | null, currency, card_ok, available_cents,
//             pending_cents, cashback_bps, outside_ok, outside_bps, test_mode, card_min_cents,
//             paid_recent: { payment_id, total_cents, paid_at } | null }] }
//   available_cents is spendable now (Available minus held credit).
//   card_min_cents is MIN_CHARGE_CENTS (money.ts), the minimum the start
//   checks on card + tip; cashback_bps is what a card part earns here.
//   MESITA-3545: outside_ok = the place has a place code (the waiter's
//   charge, so the bill can be paid outside); outside_bps is what a bill paid
//   outside and confirmed earns (0 with the Cashback switch off). An
//   outside-only place carries no Mesita Payments mark.
//   401 sign_in · 400 bad_location (+field; the client asks again without
//   one) · 500 with request_id.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { paymentsLivemode } from "../_shared/boost.ts";
import { MIN_CHARGE_CENTS, MONEY_CURRENCY } from "../_shared/money.ts";
import { moneyState } from "../_shared/money-state.ts";
import { listRowMoney, type PaymentKey, type PaymentSettings, type RateKey, SETTINGS_COLUMNS, settingsFromRow } from "../_shared/payments.ts";
import { PAID_RECENT_HOURS, type PayPlaceInput, payPlaces, readLocation } from "../_shared/pay-places.ts";

const fail = (where: string, message: string) => {
  const request_id = crypto.randomUUID();
  console.error("[consumer-web-list-pay-places]", JSON.stringify({ request_id, where, message }));
  return json({ ok: false, error: "Couldn't load Pay", request_id }, 500);
};

serveJson("consumer-web-list-pay-places", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const body = await readJsonOr<Record<string, unknown>>(req, {});
  const loc = readLocation(body);
  if (!loc.ok) return json({ ok: false, code: "bad_location", field: loc.field, error: `${loc.field} is not a coordinate` }, 400);

  const livemode = paymentsLivemode();

  // The guest's credit per place, and every account that charges in this
  // universe (the card places; few for a long time, so one read).
  const [balRes, acctRes, codeRes] = await Promise.all([
    admin.rpc("wallet_balances", { p_consumer_id: userId, p_livemode: livemode }),
    admin.from("place_payment_accounts").select("place_id").eq("charges_enabled", true).eq("livemode", livemode).limit(5000),
    // The places where the waiter's charge can open (MESITA-3545).
    admin.from("place_codes").select("place_id").limit(5000),
  ]);
  if (balRes.error) return fail("balances", balRes.error.message);
  if (acctRes.error) return fail("accounts", acctRes.error.message);
  if (codeRes.error) return fail("place_codes", codeRes.error.message);
  const balances = (balRes.data ?? []) as Array<{ place_id: string; currency: string; spendable_cents: number; pending_cents: number }>;
  const charging = new Set(((acctRes.data ?? []) as Array<{ place_id: string }>).map((r) => r.place_id));
  const coded = new Set(((codeRes.data ?? []) as Array<{ place_id: string }>).map((r) => r.place_id));

  const ids = [...new Set([...balances.map((b) => b.place_id), ...charging, ...coded])];
  if (ids.length === 0) return json({ ok: true, places: [] });

  const since = new Date(Date.now() - PAID_RECENT_HOURS * 3600_000).toISOString();
  const [placesRes, settingsRes, paidRes] = await Promise.all([
    admin.from("profiles").select("id, name, profile_photo, address, state, currency, lat, lng, boost_tier").in("id", ids),
    admin.from("place_payment_settings").select(`place_id, ${SETTINGS_COLUMNS}`).in("place_id", ids),
    admin.from("wallet_payments")
      .select("id, place_id, amount_cents, tip_cents, paid_at")
      .eq("consumer_id", userId)
      .eq("livemode", livemode)
      .eq("status", "paid")
      .gte("paid_at", since)
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);
  if (placesRes.error) return fail("places", placesRes.error.message);
  if (settingsRes.error) return fail("settings", settingsRes.error.message);
  if (paidRes.error) return fail("payments", paidRes.error.message);

  const settings = new Map<string, PaymentSettings>();
  for (const row of (settingsRes.data ?? []) as unknown as ({ place_id: string } & Partial<Record<PaymentKey | RateKey, unknown>>)[]) {
    settings.set(row.place_id, settingsFromRow(row));
  }
  const paid = new Map<string, { payment_id: string; total_cents: number; paid_at: string }>();
  for (const p of (paidRes.data ?? []) as Array<{ id: string; place_id: string; amount_cents: number; tip_cents: number | null; paid_at: string }>) {
    if (!paid.has(p.place_id)) paid.set(p.place_id, { payment_id: p.id, total_cents: p.amount_cents + (p.tip_cents ?? 0), paid_at: p.paid_at });
  }
  const credit = new Map(balances.map((b) => [b.place_id, b]));

  let cardPlaceCount = 0;
  const rows: PayPlaceInput[] = [];
  type ProfileRow = { id: string; name: string | null; profile_photo: string | null; address: string | null; state: string | null; currency: string | null; lat: number | null; lng: number | null; boost_tier: number | null };
  for (const p of (placesRes.data ?? []) as ProfileRow[]) {
    const s = settings.get(p.id) ?? settingsFromRow(null);
    const charges = charging.has(p.id);
    const active = p.state === "active";
    const cardOk = charges && s.pay_cards && active;
    // Cash Payments (MESITA-3589): the owner's switch and the place code.
    const cashState = moneyState({ ...s, has_place_code: coded.has(p.id) }, charges ? { charges_enabled: true } : null, null);
    const outsideOk = cashState.cash && active;
    if (cardOk || outsideOk) cardPlaceCount++;
    const money = listRowMoney(s, charges);
    const b = credit.get(p.id);
    rows.push({
      place_id: p.id,
      name: p.name,
      photo: p.profile_photo ?? null,
      address: p.address ?? null,
      lat: p.lat,
      lng: p.lng,
      tier: p.boost_tier,
      mesita_pay: money.mesita_pay,
      currency: (b?.currency ?? p.currency ?? MONEY_CURRENCY).toLowerCase(),
      card_ok: cardOk,
      // A closed place still owes its credit; only an active one is paid here.
      available_cents: active ? (b?.spendable_cents ?? 0) : 0,
      pending_cents: active ? (b?.pending_cents ?? 0) : 0,
      cashback_bps: cardOk ? cashState.card_cashback_bps : 0,
      outside_ok: outsideOk,
      outside_bps: outsideOk ? cashState.cash_cashback_bps : 0,
      paid_recent: paid.get(p.id) ?? null,
    });
  }

  return json({
    ok: true,
    places: payPlaces(rows, {
      at: loc.coords,
      cardPlaceCount,
      testMode: !livemode,
      minCents: (c) => MIN_CHARGE_CENTS[c] ?? 0,
    }),
  });
});
