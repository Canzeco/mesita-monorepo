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
// ONE READ FOR THE WALLET (MESITA-3814, Pato: "first load the functions
// and then display all the wallets"): with `with_cards: true` the answer
// also carries the guest's saved cards (`cards`, read from Stripe in
// parallel with everything below; null when Stripe failed, so the money
// still answers). The /wallet page paints once, from this one answer. The
// Loyalty Card, Activity and Gift reads leave it off and never wait on Stripe.
//
// Body: { session_id?: string, with_cards?: boolean }
// Response: { ok: true, test_mode,
//             balances: [{ place: { id, slug, name, photo, boost_tier, mesita_pay } | null, place_id, currency,
//               offers: { sell } (MESITA-4262, what Home's offer button says),
//                          balance_cents, available_cents, pending_cents,
//                          spendable_cents, last_at, card_ok, pinned,
//                          entries: [{ kind, amount_cents, at, pending, available_at, payment_id, confirmed_by, purchase_id, gift_id }] }],
//   available_at (MESITA-3549) rides a pending entry: when it turns
//   Available. Null on an Available entry.
//   confirmed_by (MESITA-3554) rides an 'extra' entry (legacy credit,
//   MESITA-4194) with a payment:
//   'credit' | 'stripe' | 'waiter' from wallet_payments, so Transactions
//   can name a cash bill the waiter confirmed. Null on every other entry.
//   spendable_cents (MESITA-3304) is Available minus credit held by open
//   payments, from wallet_balances: what the Pay tab can spend there now.
//   place.boost_tier is Premier's stored tier and place.mesita_pay the
//   green mark by moneyState's rule (MESITA-3514): the Wallet's marks and
//   its filter come from here, never from a catalog read.
//   pinned (MESITA-3582): the guest added this card by hand; a pinned card
//   with no entries is a $0 card they can remove.
//   card_ok (MESITA-3305) says the place can take a card part: its account
//   charges in this universe and the owner's Cards switch is on.
//             waiting_stories (MESITA-3507, MESITA-4264): [{ purchase_id, place,
//               place_id, amount_cents, bonus_cents, credit_cents, currency,
//               paid_at, token, url, state: needs_story | received | rejected |
//               approved | released | void, approved_at, expires_at (approve
//               by), bonus_at, recheck_at, bonus: released | void | null,
//               bonus_void_reason: unreachable | expired | refunded | operator | null,
//               bonus_decided_at, time_zone (the place's IANA zone),
//               mention: { id, media_url, media_kind, mentioned_at, source } | null
//               (the claimed story, else the newest unclaimed one),
//               test_mode, emulator (the Simulate buttons may show) }]:
//               Story vouchers whose bonus is undecided, plus those decided
//               in the last 24 hours (their outcome line). What the guest
//               paid is already in the balances above since MESITA-4264;
//               only the bonus waits,
//             sent_links (MESITA-3292): [{ gift_id, place_id, amount_cents,
//               currency, created_at }]: credit links the guest sent that
//               nobody took yet (already off their balance; take-back-able),
//             gifts (MESITA-4036): every gift the guest sent or received,
//               newest first, _shared/wallet-gifts.ts's GiftTicket + place:
//               status open|claimed|taken_back, role, sender and recipient
//               ({ name, photo, you }; recipient null until taken), entry,
//             can_send (MESITA-3292): sending credit is open in this
//               universe (always in test; live once money_config.sending_live),
//             outcome?: "credited" | "already_paid" | "pending" | "expired" | "mismatch" | "none",
//             settling?: true, pending_purchases?: [purchase ids],
//             cards?: [{ id, brand, last4, exp_month, exp_year, in_use }] | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { cardsAccepted, chargesEnabledByPlace, listRowMoney, type PaymentKey, SETTINGS_COLUMNS, settingsFromRow } from "../_shared/payments.ts";
import { readMoneyConfig, sendingOn } from "../_shared/money-config.ts";
import { readPins, withPins } from "../_shared/loyalty-cards.ts";
import { MONEY_CURRENCY } from "../_shared/money.ts";
import {
  balanceKey,
  balancesOf,
  type Entry,
  type OpenPurchase,
  readWalletPlaces,
  settleAll,
  type SettleOutcome,
} from "../_shared/wallet.ts";
import { readSavedCards } from "../_shared/cards.ts";
import { withGuestOffers } from "../_shared/vouchers.ts";
import { STORY_COLUMNS, storyBonusAt, type StoryRow, storyState } from "../_shared/story.ts";
import {
  MENTION_COLUMNS,
  type MentionRow,
  mentionView,
  STORY_RULES,
  storyMode,
} from "../_shared/story-mention.ts";
import { placeZone, PLACE_ZONE_COLUMNS } from "../_shared/local-time.ts";
import { type GiftEntryRow, giftPeopleIds, type GiftRow, giftTickets, type PersonRow } from "../_shared/wallet-gifts.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

/** How long one read waits on Stripe for every open purchase together. */
const SETTLE_BUDGET_MS = 3000;

serveJson("consumer-web-get-wallet", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const body = await readJsonOr<Record<string, unknown>>(req, {});
  const sessionId = typeof body.session_id === "string" ? body.session_id : null;

  const livemode = paymentsLivemode();
  // Started first, awaited last: Stripe's card list runs beside the reads.
  const cardsRead = body.with_cards === true ? readSavedCards(admin, userId, livemode) : null;

  // ── Settle what is still open ──────────────────────────────────────────
  const { data: open, error: openErr } = await admin
    .from("wallet_purchases")
    .select("id, stripe_checkout_session_id, stripe_account_id, created_at, voucher, stripe_payment_intent_id")
    .eq("consumer_id", userId)
    .eq("livemode", livemode)
    .in("status", ["opening", "open"])
    .order("created_at", { ascending: true })
    .limit(20);
  if (openErr) return json({ ok: false, error: `purchases: ${openErr.message}` }, 500);

  let outcome: SettleOutcome | "none" | undefined = sessionId ? "none" : undefined;
  let settling: string[] = [];
  const key = paymentsStripeKey();
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
    .select("place_id, kind, amount_cents, currency, created_at, available_at, payment_id, purchase_id, gift_id")
    .eq("consumer_id", userId)
    .eq("livemode", livemode)
    .order("created_at", { ascending: false })
    .limit(1000); // newest 1000 across places; a heavy guest's oldest history can stop short (MESITA-3750)
  if (entriesErr) return json({ ok: false, error: `entries: ${entriesErr.message}` }, 500);
  const { data: sums, error: sumsErr } = await admin.rpc("wallet_balances", {
    p_consumer_id: userId,
    p_livemode: livemode,
  });
  if (sumsErr) return json({ ok: false, error: `balances: ${sumsErr.message}` }, 500);
  const spendable = new Map<string, number>();
  for (const r of (sums ?? []) as Array<{ place_id: string; currency: string; spendable_cents: number }>) {
    spendable.set(balanceKey(r.place_id, r.currency), r.spendable_cents);
  }
  // WHO CONFIRMED AN EXTRA CREDIT'S PAYMENT (MESITA-3554): one read of the
  // payments behind the 'extra' entries. A failed read leaves confirmed_by
  // null; the money is unaffected.
  const entries = (rows ?? []) as Entry[];
  const extraPayments = [
    ...new Set(entries.filter((e) => e.kind === "extra" && e.payment_id).map((e) => e.payment_id as string)),
  ];
  if (extraPayments.length > 0) {
    const { data: payRows, error: payErr } = await admin
      .from("wallet_payments")
      .select("id, confirmed_by")
      .eq("consumer_id", userId)
      .in("id", extraPayments);
    if (payErr) console.error(`[consumer-web-get-wallet] confirmed_by read: ${payErr.message}`);
    const confirmedBy = new Map(
      ((payErr ? [] : payRows) ?? []).map((p: { id: string; confirmed_by: Entry["confirmed_by"] }) => [p.id, p.confirmed_by]),
    );
    for (const e of entries) {
      if (e.kind === "extra" && e.payment_id) e.confirmed_by = confirmedBy.get(e.payment_id) ?? null;
    }
  }
  // PINNED LOYALTY CARDS (MESITA-3582): a place the guest added by hand with
  // no entries reads as a $0 card after the ones holding money, never twice.
  const pinsRes = await readPins(admin, userId);
  if (!pinsRes.ok) return json({ ok: false, error: pinsRes.error }, 500);
  const balances = withPins(balancesOf(entries, Date.now(), spendable), pinsRes.pins, MONEY_CURRENCY);

  // STORIES (MESITA-3507, MESITA-4264, MESITA-4297): the waiter approved the
  // story before payment; what the guest paid is in the balances above since
  // payment; the row shows where the bonus stands: every bought Story still
  // processing or waiting for its 3-hour re-check, and a decided one for 24
  // hours.
  const decidedSince = new Date(Date.now() - STORY_RULES.decidedListedSec * 1000).toISOString();
  const { data: storyRows, error: storyErr } = await admin
    .from("wallet_purchases")
    .select(STORY_COLUMNS)
    .eq("consumer_id", userId)
    .eq("livemode", livemode)
    .eq("voucher", "voucher_story")
    .or(`status.in.(opening,open),and(status.eq.paid,story_bonus.is.null),story_bonus_decided_at.gte.${decidedSince}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (storyErr) return json({ ok: false, error: `stories: ${storyErr.message}` }, 500);
  const stories = (storyRows ?? []) as StoryRow[];
  // The story each used. A failed read only hides the image; the money is unaffected.
  let claimedByPurchase = new Map<string, MentionRow>();
  const storyZones = new Map<string, string>();
  if (stories.length > 0) {
    try {
      const [claimed, zones] = await Promise.all([
        admin.from("story_mentions").select(MENTION_COLUMNS).in("purchase_id", stories.map((st) => st.id)),
        admin.from("place_profiles").select(`id, ${PLACE_ZONE_COLUMNS}`).in("id", [...new Set(stories.map((st) => st.place_id))]),
      ]);
      if (claimed.error) throw new Error(`story_mentions: ${claimed.error.message}`);
      claimedByPurchase = new Map(((claimed.data ?? []) as MentionRow[]).map((m) => [m.purchase_id as string, m]));
      for (const z of ((zones.error ? [] : zones.data) ?? []) as Array<{ id: string; timezone?: unknown; lng?: unknown }>) {
        storyZones.set(z.id, placeZone(z));
      }
    } catch (e) {
      console.error(`[consumer-web-get-wallet] story mentions read: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const emulatorOn = !livemode && storyMode() === "emulated";

  // EVERY GIFT SENT OR RECEIVED (MESITA-4036): Tickets' one Gifts list,
  // sender on the left, receiver on the right. The open ones the guest sent
  // are also the credit links (MESITA-3292), whose gift_out already took the
  // credit off the balances above.
  const [{ data: giftRows, error: giftErr }, moneyConfig] = await Promise.all([
    admin
      .from("wallet_gifts")
      .select("id, sender_id, recipient_id, place_id, amount_cents, currency, status, created_at, claimed_at, taken_back_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq("livemode", livemode)
      .order("created_at", { ascending: false })
      .limit(100),
    readMoneyConfig(admin),
  ]);
  if (giftErr) return json({ ok: false, error: `gifts: ${giftErr.message}` }, 500);
  const gifts = (giftRows ?? []) as GiftRow[];
  const sentLinks = gifts.filter((g) => g.sender_id === userId && g.status === "open").slice(0, 50);
  // The people and the guest's own ledger lines behind them. A failed read
  // only blanks names and entry links; the money is unaffected.
  const giftIds = gifts.map((g) => g.id);
  const [peopleRes, giftEntriesRes] = giftIds.length === 0
    ? [{ data: [], error: null }, { data: [], error: null }]
    : await Promise.all([
      admin.from("consumers").select("id, first_name, avatar_url, appear_anonymous").in("id", giftPeopleIds(gifts)),
      admin.from("wallet_entries").select("gift_id, kind, created_at, available_at").eq("consumer_id", userId).in("gift_id", giftIds),
    ]);
  if (peopleRes.error) console.error(`[consumer-web-get-wallet] gift people read: ${peopleRes.error.message}`);
  if (giftEntriesRes.error) console.error(`[consumer-web-get-wallet] gift entries read: ${giftEntriesRes.error.message}`);
  const giftList = giftTickets(
    gifts,
    ((peopleRes.error ? [] : peopleRes.data) ?? []) as PersonRow[],
    ((giftEntriesRes.error ? [] : giftEntriesRes.data) ?? []) as GiftEntryRow[],
    userId,
  );

  const ids = [
    ...new Set([...balances.map((b) => b.place_id), ...stories.map((s) => s.place_id), ...gifts.map((g) => g.place_id)]),
  ];
  // card_ok (MESITA-3305): the place's account can charge in this universe
  // and the owner's Cards switch is on, so the Pay tab may offer a card
  // part there. A failed read reads as no card; the server is the last word
  // at start anyway.
  const [placesRes, charging, settingsRes] = await Promise.all([
    readWalletPlaces(admin, ids),
    chargesEnabledByPlace(admin, ids, livemode),
    ids.length > 0
      ? admin.from("place_payment_settings").select(`place_id, ${SETTINGS_COLUMNS}`).in("place_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (!placesRes.ok) return json({ ok: false, error: placesRes.error }, 500);
  const places = placesRes.places;
  if (settingsRes.error) console.error(`[consumer-web-get-wallet] settings read: ${settingsRes.error.message}`);
  // Mesita Payments On: only a row saying so (no row is Off, MESITA-3599).
  const cardsOn = new Set<string>();
  // via unknown: a template-string select widens `data` (as in payments.ts).
  const settingRows = ((settingsRes.error ? [] : settingsRes.data) ?? []) as unknown as Array<
    { place_id: string } & Partial<Record<PaymentKey, unknown>>
  >;
  const settingsById = new Map(settingRows.map((r) => [r.place_id, r]));
  for (const r of settingRows) {
    if (cardsAccepted(settingsFromRow(r))) cardsOn.add(r.place_id);
  }
  // THE GREEN MARK (MESITA-3514): the list rows' rule, so a Wallet card
  // and a Home tile never disagree. A failed settings read reads as no row.
  for (const [id, place] of places) {
    place.mesita_pay = listRowMoney(settingsFromRow(settingsById.get(id) ?? null), charging?.has(id) ?? false).mesita_pay;
  }

  // THE OFFERS (MESITA-4262, Pato: "important to display offers inside
  // wallet too … a super important selling point"): each card's switching
  // offers, the list rows' rule (withVouchersUpTo's listRowMoney, the
  // buying_paused kill switch, then what this guest can buy), so a Loyalty
  // Card and a Home tile say the same offers. A failed guest read keeps the
  // place's list (withGuestOffers logs it).
  const offerRows = await withGuestOffers(
    admin,
    userId,
    balances.map((b) => ({
      id: b.place_id,
      offers: {
        sell: moneyConfig.buying_paused
          ? []
          : listRowMoney(settingsFromRow(settingsById.get(b.place_id) ?? null), charging?.has(b.place_id) ?? false).sell,
      },
    })),
  );
  const offersById = new Map(offerRows.map((r) => [r.id, r.offers]));

  const cards = cardsRead ? await cardsRead : undefined;

  return json({
    ok: true,
    test_mode: !livemode,
    ...(cards === undefined ? {} : { cards }),
    balances: balances.map(({ place_id, ...b }) => ({
      place: places.get(place_id) ?? null,
      place_id,
      ...b,
      card_ok: (charging?.has(place_id) ?? false) && cardsOn.has(place_id),
      offers: offersById.get(place_id) ?? { sell: [] },
    })),
    waiting_stories: stories.map((st) => {
      const mention = claimedByPurchase.get(st.id) ?? null;
      const state = storyState(st);
      return {
        purchase_id: st.id,
        place: places.get(st.place_id) ?? null,
        place_id: st.place_id,
        amount_cents: st.amount_cents,
        bonus_cents: st.bonus_cents,
        credit_cents: st.amount_cents + st.bonus_cents,
        currency: st.currency,
        paid_at: st.paid_at,
        state,
        approved_at: st.story_activated_at,
        /** The bonus lands then if the story is still up (3 hours after payment). */
        bonus_at: storyBonusAt(st),
        recheck_at: st.story_recheck_at ?? null,
        bonus: st.story_bonus ?? null,
        bonus_void_reason: st.story_bonus_void_reason ?? null,
        bonus_decided_at: st.story_bonus_decided_at ?? null,
        time_zone: storyZones.get(st.place_id) ?? placeZone(null),
        mention: mention ? mentionView(mention) : null,
        test_mode: !st.livemode,
        emulator: emulatorOn && !st.livemode && state === "approved" && mention?.source === "emulator",
      };
    }),
    sent_links: sentLinks.map((g) => ({
      gift_id: g.id,
      place_id: g.place_id,
      amount_cents: g.amount_cents,
      currency: g.currency,
      created_at: g.created_at,
    })),
    gifts: giftList.map((g) => ({ ...g, place: places.get(g.place_id) ?? null })),
    can_send: sendingOn(moneyConfig, livemode),
    ...(outcome === undefined ? {} : { outcome }),
    ...(settling.length > 0 ? { settling: true, pending_purchases: settling } : {}),
  });
});
