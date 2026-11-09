// What a place's Billing page says (MESITA-3166, Design D1–D13): the level
// and until when, the Refill days and the subscription as rows, what is
// charged next and when, and the one thing to do. Pure: index.ts reads the
// rows and the card, this decides; the page only formats what comes back.

import {
  type BoostInterval,
  inEarlyWindow,
  localDay,
  type Manual,
  type Period,
  type Pledge,
  PREMIER_YEARLY_CENTS,
  type PremierPrices,
  runEndAtOrAbove,
  runningPeriod,
  subscriptionOf,
  TIER_BY_RANK,
  TIER_RANK,
  type TierRank,
} from "../_shared/boost.ts";

export type Card = { brand: string; last4: string; exp_month: number; exp_year: number };

/** Where Refill days came from (D9): admin = given by Mesita, a code, or a
 *  guest's purchase. */
export type Origin = "mesita" | "guest";
const ORIGIN: Record<Manual["source"], Origin> = { admin: "mesita", purchase: "guest" };

export type BillingView = {
  /** The place's time zone; every date on the page is drawn in it (D12). */
  timezone: string;
  /** Today's date there, YYYY-MM-DD, and the instant the view was made
   *  (the page draws its timeline from it). */
  today: string;
  now: string;
  payer: "you" | "team" | null;
  /** The level now and until when it holds; `until` is null at 0 or while a
   *  subscription renews it. `days_left` only within 7 days. */
  level: { tier: 0 | TierRank; until: string | null; days_left: number | null };
  /** Running and queued Refill days, in the order they run. */
  refill: Array<{ id: string; tier: TierRank; origin: Origin; starts_at: string; ends_at: string; state: "running" | "next" }>;
  subscription: null | {
    tier: TierRank;
    interval: BoostInterval;
    amount_cents: number;
    /** running: renews at next_charge_at; paused: Refill days run, the paid
     *  time resumes at resumes_at; waiting: nothing paid yet (subscribed
     *  early, or due), first charged at next_charge_at; charging: a charge is
     *  in flight now. */
    state: "running" | "paused" | "waiting" | "charging";
    next_charge_at: string | null;
    next_charge_cents: number;
    resumes_at: string | null;
    early_start: boolean;
  };
  /** The resume (or first charge) date moved in the last 30 days (D13). */
  moved: null | { from: string; to: string; days: number; origin: Origin; granted_at: string };
  /** Keep <tier> (D7/D11): the run at or above `tier` ends within 7 days and
   *  nobody subscribes; first charge `price_cents` on `ends_at`. */
  keep: null | { tier: TierRank; ends_at: string; price_cents: number };
  /** Outside that window: the first day (YYYY-MM-DD, place time zone) each
   *  tier can be subscribed to (M6). */
  subscribe_from: Partial<Record<TierRank, string>>;
  card: Card | null;
  /** The payer's card expires before the next charge (D8). */
  card_expires_before_charge: boolean;
};

const ms = (iso: string) => Date.parse(iso);
const DAY_MS = 86_400_000;

function dayString(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** The first instant a card no longer works: the start of the month after
 *  its expiry month (UTC). */
export function cardExpiresAt(card: Card): number {
  return Date.UTC(card.exp_year, card.exp_month, 1);
}

export function billingView(args: {
  pledges: Pledge[];
  periods: Period[];
  manual: Manual[];
  timezone: string | null | undefined;
  viewerId: string;
  card: Card | null;
  now: number;
  /** The operator's yearly prices (MESITA-3043); the defaults if absent. */
  prices?: PremierPrices;
}): BillingView {
  const { pledges, periods, viewerId, card, now } = args;
  const tz = args.timezone || "UTC";
  const today = localDay(now, tz);

  const live = args.manual
    .filter((m) => ms(m.ends_at) > now && ms(m.ends_at) > ms(m.starts_at))
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at));
  const refill = live.map((m) => ({
    id: m.id,
    tier: m.tier as TierRank,
    origin: ORIGIN[m.source] ?? "mesita",
    starts_at: m.starts_at,
    ends_at: m.ends_at,
    state: ms(m.starts_at) <= now ? "running" as const : "next" as const,
  }));

  const sub = subscriptionOf(pledges);
  const payer = sub ? (sub.consumer_id === viewerId ? "you" : "team") : null;
  const anyRunning = runningPeriod(periods, now);
  const running = anyRunning && sub && anyRunning.backing_id === sub.id ? anyRunning : null;
  const charging = periods.some((p) => p.status === "charging");

  let subscription: BillingView["subscription"] = null;
  if (sub) {
    const tier = TIER_RANK[sub.tier];
    const nextCents = sub.pending_amount_cents ?? sub.amount_cents;
    const base = {
      tier,
      interval: sub.billing_interval,
      amount_cents: sub.amount_cents,
      next_charge_cents: nextCents,
      early_start: !!sub.early_start,
    };
    if (charging) {
      subscription = { ...base, state: "charging", next_charge_at: null, resumes_at: null };
    } else if (running) {
      const paused = !!running.covered_until && ms(running.covered_until) > now;
      subscription = {
        ...base,
        state: paused ? "paused" : "running",
        next_charge_at: running.ends_at,
        resumes_at: paused ? running.covered_until : null,
      };
    } else {
      // Nothing paid runs: the first charge waits for the Refill days at or
      // above its tier to end (premier_begin_renewal, every 5 minutes).
      subscription = {
        ...base,
        state: "waiting",
        next_charge_at: runEndAtOrAbove(args.manual, tier, now) ?? new Date(now).toISOString(),
        resumes_at: null,
      };
    }
  }

  // The level: the higher of the running Refill row and the paid period.
  const refillTier = refill.find((r) => r.state === "running")?.tier ?? 0;
  const paidTier = anyRunning ? anyRunning.tier : 0;
  const levelTier = Math.max(refillTier, paidTier) as 0 | TierRank;
  let until: string | null = null;
  if (levelTier > 0) {
    const refillEnd = runEndAtOrAbove(args.manual, levelTier, now);
    const paidHolds = anyRunning && anyRunning.tier >= levelTier;
    const renews = paidHolds && running && !!sub?.stripe_payment_method_id;
    if (!renews) {
      const ends = [refillEnd, paidHolds ? anyRunning!.ends_at : null].filter((d): d is string => !!d);
      until = ends.sort((a, b) => ms(b) - ms(a))[0] ?? null;
    }
  }
  const left = until ? localDay(ms(until), tz) - today : null;
  const level = { tier: levelTier, until, days_left: left !== null && left <= 7 ? Math.max(0, left) : null };

  // Moved (D13): the date the subscription next starts paying moved by the
  // latest grant, made in the last 30 days, after the subscription began.
  let moved: BillingView["moved"] = null;
  const target = subscription?.resumes_at ?? (subscription?.state === "waiting" ? subscription.next_charge_at : null);
  if (sub && subscription && target) {
    const latest = args.manual
      .filter((m) => m.created_at && ms(m.ends_at) > ms(m.starts_at))
      .sort((a, b) => ms(b.created_at!) - ms(a.created_at!))[0];
    if (
      latest &&
      now - ms(latest.created_at!) <= 30 * DAY_MS &&
      ms(latest.created_at!) > ms(sub.created_at) &&
      latest.tier >= subscription.tier &&
      ms(latest.ends_at) <= ms(target) + 1000
    ) {
      const length = ms(latest.ends_at) - ms(latest.starts_at);
      moved = {
        from: new Date(ms(target) - length).toISOString(),
        to: target,
        days: Math.round(length / DAY_MS),
        origin: ORIGIN[latest.source] ?? "mesita",
        granted_at: latest.created_at!,
      };
    }
  }

  // Keep <tier> (D11) and "You can subscribe from" (M6): only for a place
  // nobody pays for (premier_make_payer's rule, MESITA-3165).
  let keep: BillingView["keep"] = null;
  const subscribeFrom: BillingView["subscribe_from"] = {};
  if (!sub && !anyRunning && !charging) {
    for (const t of [2, 1] as const) {
      const runEnd = runEndAtOrAbove(args.manual, t, now);
      if (!runEnd) continue;
      if (inEarlyWindow(runEnd, now, tz)) {
        keep ??= { tier: t, ends_at: runEnd, price_cents: (args.prices ?? PREMIER_YEARLY_CENTS)[TIER_BY_RANK[t]] };
      } else {
        subscribeFrom[t] = dayString(localDay(ms(runEnd), tz) - 7);
      }
    }
  }

  const chargeAt = subscription?.next_charge_at;
  const cardExpires = payer === "you" && card && chargeAt ? cardExpiresAt(card) <= ms(chargeAt) : false;

  return {
    timezone: tz,
    today: dayString(today),
    now: new Date(now).toISOString(),
    payer,
    level,
    refill,
    subscription,
    moved,
    keep,
    subscribe_from: subscribeFrom,
    card,
    card_expires_before_charge: cardExpires,
  };
}

/** A card saved on the caller's own Stripe customer (MESITA-3185). */
export type SavedCard = Card & { id: string; in_use: boolean };

/** Stripe's card payment methods as Billing lists them: brand, last 4 and
 *  expiry, never more. The one this place's plan charges comes first. */
export function savedCards(methods: unknown, inUseId: string | null | undefined): SavedCard[] {
  const rows = Array.isArray(methods) ? (methods as Array<{ id?: unknown; card?: Partial<Card> }>) : [];
  const cards: SavedCard[] = [];
  for (const m of rows) {
    if (typeof m.id !== "string" || !m.card?.last4) continue;
    cards.push({
      id: m.id,
      brand: String(m.card.brand ?? "card"),
      last4: m.card.last4,
      exp_month: Number(m.card.exp_month),
      exp_year: Number(m.card.exp_year),
      in_use: m.id === inUseId,
    });
  }
  return cards.sort((a, b) => Number(b.in_use) - Number(a.in_use));
}

/** Payment intent → Stripe's receipt page, from a customer's charges. Only a
 *  paid charge has a receipt worth opening: a declined try on the same intent
 *  never replaces it. */
export function receiptsByIntent(charges: unknown): Map<string, string> {
  const rows = Array.isArray(charges) ? (charges as Array<{ payment_intent?: unknown; paid?: unknown; receipt_url?: unknown }>) : [];
  const out = new Map<string, string>();
  for (const c of rows) {
    if (c.paid === true && typeof c.payment_intent === "string" && typeof c.receipt_url === "string") {
      out.set(c.payment_intent, c.receipt_url);
    }
  }
  return out;
}
