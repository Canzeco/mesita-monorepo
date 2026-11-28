// Supabase Edge Function — consumer-web-list-pay-places
//
// MESITA-3457: the Pay tab's list. Every active Mesita place (MESITA-4986:
// All places is the catalog, a missing offer is 0%), plus a closed place
// where the guest holds credit, where a bill can be paid outside
// (`outside_ok`) or where there are offers, nearest first (MESITA-3536).
// Which places are listed, the radius and the cap are
// _shared/pay-places.ts. MESITA-4708: no `card_ok` or `card_min_cents` (no
// card for a bill).
// consumer-web-start-payment is unchanged: this only lists.
//
// The location is used for distance and dropped: never stored, never
// logged, and neither is the body.
//
// Body: { lat?: number, lng?: number } (the client rounds to 3 decimals)
// Response: { ok: true, places: [{ place_id, name, photo, address, marks: { tier, mesita_pay },
//             distance_m | null, currency, available_cents,
//             pending_cents, outside_ok, test_mode,
//             paid_recent: { payment_id, total_cents, paid_at } | null,
//             offers_ok, credits_ok, offers: { sell, cashback_pct, cashback_flat,
//             welcome_pct, welcome_vip_pct, returning_pct, returning_vip_pct } }] }
//   MESITA-4748: welcome_pct | returning_pct, the two Back lines apart, for
//   the Pay Bill sheet's two boxes.
//   credits_ok = Loyalty Cards On at an active place (the place takes Mesita
//   credit).
//   MESITA-4698: offers_ok = Loyalty Cards On at an active place (cashback,
//   and vouchers where sold): Pay's Get Offers lists these.
//   visit_line = welcome (no paid bill here yet) | returning; VIP or not (MESITA-5072).
//   MESITA-4519: offers is what Home's and the place screen's offer slides
//   read (withVouchersUpTo), so each Pay card carries the same carousel.
//   available_cents is spendable now (Available minus held credit).
//   MESITA-3545: outside_ok = the place has a place code (the waiter's
//   charge, so the bill can be paid outside). An outside-only place carries
//   no Mesita Payments mark.
//   401 sign_in · 400 bad_location (+field; the client asks again without
//   one) · 500 with request_id.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import { moneyState } from "../_shared/money-state.ts";
import { listRowMoney, NO_LIST_ROW_OFFERS, type PaymentKey, type PaymentSettings, SETTINGS_COLUMNS, settingsFromRow, withVouchersUpTo } from "../_shared/payments.ts";
import { PAID_RECENT_HOURS, type PayPlaceInput, payPlaces, readLocation } from "../_shared/pay-places.ts";
import { chunked, ID_CHUNK } from "../_shared/postgrest.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

const PROFILE_COLUMNS = "id, name, profile_photo, address, state, currency, lat, lng, boost_tier";

type ProfileRow = {
  id: string;
  name: string | null;
  profile_photo: string | null;
  address: string | null;
  state: string | null;
  currency: string | null;
  lat: number | null;
  lng: number | null;
  boost_tier: number | null;
};

/** `.in()` rides in the URL. One chunk per ID_CHUNK, same as the other readers. */
async function readIn<T>(
  ids: string[],
  run: (ids: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (const some of chunked(ids, ID_CHUNK)) {
    const res = await run(some);
    if (res.error) return { rows, error: res.error.message };
    rows.push(...(res.data ?? []));
  }
  return { rows, error: null };
}

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
    admin.from("place_waiters").select("place_id").is("removed_at", null).limit(5000),
  ]);
  if (balRes.error) return fail("balances", balRes.error.message);
  if (acctRes.error) return fail("accounts", acctRes.error.message);
  if (codeRes.error) return fail("place_waiters", codeRes.error.message);
  const balances = (balRes.data ?? []) as Array<{ place_id: string; currency: string; spendable_cents: number; pending_cents: number }>;
  const charging = new Set(((acctRes.data ?? []) as Array<{ place_id: string }>).map((r) => r.place_id));
  const coded = new Set(((codeRes.data ?? []) as Array<{ place_id: string }>).map((r) => r.place_id));

  // Every active place (MESITA-4986: All places is the catalog), plus a
  // closed place where this guest still holds credit or a code.
  const activeRes = await admin.from("profiles").select(PROFILE_COLUMNS).eq("state", "active").limit(1000);
  if (activeRes.error) return fail("places", activeRes.error.message);
  const active = (activeRes.data ?? []) as ProfileRow[];
  const activeIds = new Set(active.map((p) => p.id));
  const extraIds = [...new Set([...balances.map((b) => b.place_id), ...charging, ...coded])].filter((id) => !activeIds.has(id));
  const extras = await readIn<ProfileRow>(extraIds, (some) => admin.from("profiles").select(PROFILE_COLUMNS).in("id", some));
  if (extras.error) return fail("places", extras.error);
  const profiles = [...active, ...extras.rows];
  const ids = profiles.map((p) => p.id);
  if (ids.length === 0) return json({ ok: true, places: [] });

  const since = new Date(Date.now() - PAID_RECENT_HOURS * 3600_000).toISOString();
  const [settingsRes, paidRes, billedRes] = await Promise.all([
    readIn<unknown>(ids, (some) => admin.from("place_payment_settings").select(`place_id, ${SETTINGS_COLUMNS}`).in("place_id", some)),
    admin.from("wallet_payments")
      .select("id, place_id, amount_cents, tip_cents, paid_at")
      .eq("consumer_id", userId)
      .eq("livemode", livemode)
      .eq("status", "paid")
      .gte("paid_at", since)
      .order("paid_at", { ascending: false })
      .limit(50),
    // MESITA-4770: the places where this guest has a paid bill, so the phone
    // previews the right visit line (Welcome before the first, Returning
    // after); pay_guest_begin decides the same and has the last word.
    readIn<{ place_id: string }>(ids, (some) =>
      admin.from("pay_tabs").select("place_id").eq("consumer_id", userId).eq("livemode", livemode)
        .eq("status", "paid").in("place_id", some).limit(5000)),
  ]);
  if (settingsRes.error) return fail("settings", settingsRes.error);
  if (paidRes.error) return fail("payments", paidRes.error.message);
  if (billedRes.error) return fail("bills", billedRes.error);
  const billed = new Set(billedRes.rows.map((r) => r.place_id));

  const settings = new Map<string, PaymentSettings>();
  for (const row of settingsRes.rows as ({ place_id: string } & Partial<Record<PaymentKey, unknown>>)[]) {
    settings.set(row.place_id, settingsFromRow(row));
  }
  const paid = new Map<string, { payment_id: string; total_cents: number; paid_at: string }>();
  for (const p of (paidRes.data ?? []) as Array<{ id: string; place_id: string; amount_cents: number; tip_cents: number | null; paid_at: string }>) {
    if (!paid.has(p.place_id)) paid.set(p.place_id, { payment_id: p.id, total_cents: p.amount_cents + (p.tip_cents ?? 0), paid_at: p.paid_at });
  }
  const credit = new Map(balances.map((b) => [b.place_id, b]));

  let outsidePlaceCount = 0;
  const rows: PayPlaceInput[] = [];
  for (const p of profiles) {
    const s = settings.get(p.id) ?? settingsFromRow(null);
    const charges = charging.has(p.id);
    const active = p.state === "active";
    // Cash Payments (MESITA-3589): the owner's switch and the place code.
    const cashState = moneyState({ ...s, has_place_code: coded.has(p.id) }, charges ? { charges_enabled: true } : null, null);
    const outsideOk = cashState.cash && active;
    if (outsideOk) outsidePlaceCount++;
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
      // A closed place still owes its credit; only an active one is paid here.
      available_cents: active ? (b?.spendable_cents ?? 0) : 0,
      pending_cents: active ? (b?.pending_cents ?? 0) : 0,
      outside_ok: outsideOk,
      offers_ok: active && s.loyalty_cards === true,
      on_mesita: active,
      paid_recent: paid.get(p.id) ?? null,
    });
  }

  const listed = payPlaces(rows, {
    at: loc.coords,
    outsidePlaceCount,
    testMode: !livemode,
  });
  // The offer slides (MESITA-4519): one batched read for the listed places,
  // the same rule as Home's rows. It logs its own failures and answers no
  // offers then, so Pay still lists.
  const withOffers = await withVouchersUpTo(admin, listed.map((p) => ({ id: p.place_id })));
  const offers = new Map(withOffers.map((r) => [r.id, r.offers]));
  return json({
    ok: true,
    places: listed.map((p) => {
      const o = offers.get(p.place_id) ?? NO_LIST_ROW_OFFERS;
      return {
        ...p,
        // Accepts Credits is Loyalty Cards on.
        credits_ok: p.offers_ok,
        offers_ok: p.offers_ok,
        visit_line: billed.has(p.place_id) ? "returning" : "welcome",
        offers: o,
      };
    }),
  });
});
